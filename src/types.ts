export interface SshConfig {
  host: string
  port: number
  username: string
  password: string
  session?: string
  mode?: 'ssh' | 'agent' | 'local'
}
