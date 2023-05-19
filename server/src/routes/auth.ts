import { FastifyInstance } from 'fastify'
import axios from 'axios'
import { z } from 'zod'
import { prisma } from '../lib/prisma'

export async function authRoutes(app: FastifyInstance) {
  app.post('/register', async (request) => {
    const bodySchema = z.object({
      code: z.string(),
    })
    const { code } = bodySchema.parse(request.body)
    const accesTokenResponse = await axios.post(
      'https://github.com/login/auth/access_token',
      null,
      {
        params: {
          client_id: process.env.GITHUB_CLIENT_ID,
          client_secret: process.env.GITHUB_CLIENT_SECRET,
          code,
        },
        headers: {
          Accept: 'application/json',
        },
      },
    )
    const { access_token } = accesTokenResponse.data
    const userResponse = await axios.get('https://api.github.com/users', {
      headers: {
        Authorization: `token ${access_token}`,
      },
    })
    const userSchdema = z.object({
      id: z.number(),
      login: z.string(),
      name: z.string(),
      avatar_url: z.string().url(),
    })
    const userInfo = userSchdema.parse(userResponse.data)
    let user = await prisma.user.findUnique({
      where: {
        githubId: userInfo.id,
      },
    })
    if (!user) {
      user = await prisma.user.create({
        data: {
          githubId: userInfo.id,
          login: userInfo.login,
          name: userInfo.name,
          avatarUrl: userInfo.avatar_url,
        },
      })
    }
    const token = app.jwt.sign(
      {
        name: user.name,
        avatarUrl: user.avatarUrl,
      },
      {
        sub: user.id,
        expiresIn: '7 days',
      },
    )
    return {
      token,
    }
  })
}
