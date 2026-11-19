import jwt from 'jsonwebtoken'

export const AUTH_COOKIE = 'jwtForStorytelling'
export const cookieOptions = () => ({
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  path: '/',
})

export const generateToken = (userId, res) => {
  const token = jwt.sign({ userId }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '7d' })
  res.cookie(AUTH_COOKIE, token, {
    ...cookieOptions(),
    maxAge: 7 * 24 * 60 * 60 * 1000,
  })
  return token
}
