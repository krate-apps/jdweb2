/**
 * Reset a jdweb user's password from the CLI.
 * Usage: pnpm --filter ./server exec tsx scripts/reset-password.ts <username> <newPassword>
 */
import { initDb, closeDb } from '../src/db.js'
import { findUserByUsername, updateUserPassword } from '../src/users.js'

const username = process.argv[2]
const password = process.argv[3]
if (!username || !password) {
  console.error('Usage: tsx scripts/reset-password.ts <username> <newPassword>')
  process.exit(1)
}

initDb()
const user = findUserByUsername(username)
if (!user) {
  console.error(`User not found: ${username}`)
  closeDb()
  process.exit(1)
}
await updateUserPassword(user.id, password)
console.log(`Password updated for ${username}`)
closeDb()
