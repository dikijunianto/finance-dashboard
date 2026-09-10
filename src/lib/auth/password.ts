import bcrypt from "bcryptjs";

export async function validCredentials(username: string, password: string) {
  const configuredUsername = process.env.AUTH_USERNAME;
  const hash = process.env.AUTH_PASSWORD_HASH;
  if (!configuredUsername || !hash) throw new Error("Authentication environment variables are missing.");
  return username === configuredUsername && await bcrypt.compare(password, hash);
}
