export interface SshConfig {
  host: string
  port: number
  username: string
  password: string
  session?: string
  useTmux?: boolean
  mode?: 'ssh' | 'agent' | 'local'
}
