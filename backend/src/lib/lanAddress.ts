import os from 'os';

/** Non-loopback IPv4 addresses for dev LAN access (e.g. 192.168.x.x). */
export function getLanIPv4Addresses(): string[] {
  const addresses: string[] = [];

  for (const interfaces of Object.values(os.networkInterfaces())) {
    if (!interfaces) continue;
    for (const iface of interfaces) {
      if (iface.family !== 'IPv4' || iface.internal) continue;
      addresses.push(iface.address);
    }
  }

  return addresses;
}

export function getPrimaryLanIPv4(): string | undefined {
  return getLanIPv4Addresses()[0];
}
