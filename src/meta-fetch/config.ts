
import { seal } from 'bind:Object'

export interface Config {
  nicoUrlType: 'watch' | 'tree'
  hostOfJmcomic: string | null
}

export const config: Config = seal({
  __proto__: null!,
  nicoUrlType: 'tree',
  hostOfJmcomic: null,
})
