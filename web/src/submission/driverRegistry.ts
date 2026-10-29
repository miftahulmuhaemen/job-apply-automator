import type { PortalDriver, JobRecord } from './types.js'
import { KalibrrDriver } from './drivers/kalibrrDriver.js'

class DriverRegistry {
  private drivers: Map<string, PortalDriver> = new Map()

  constructor() {
    // Register initial default portal driver
    this.registerDriver(new KalibrrDriver())
  }

  registerDriver(driver: PortalDriver): void {
    this.drivers.set(driver.id.toLowerCase(), driver)
  }

  getDriver(id: string): PortalDriver | undefined {
    return this.drivers.get(id.toLowerCase())
  }

  findDriverForJob(job: { portal?: string | null; job_url: string }): PortalDriver | undefined {
    for (const driver of this.drivers.values()) {
      if (driver.canHandle(job)) {
        return driver
      }
    }
    return undefined
  }

  getSupportedDrivers(): Array<{ id: string; name: string }> {
    return Array.from(this.drivers.values()).map(d => ({ id: d.id, name: d.name }))
  }
}

export const driverRegistry = new DriverRegistry()
