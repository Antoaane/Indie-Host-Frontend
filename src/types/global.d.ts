// File: src/types/global.d.ts

interface NavigatorUAData {
  platform: string
  platformVersion?: string
  getHighEntropyValues?(hints: string[]): Promise<Record<string, any>>
}

interface Navigator {
  userAgentData?: NavigatorUAData
}

type OSInfo = {
  os: string
  version: string
  source: string
}
