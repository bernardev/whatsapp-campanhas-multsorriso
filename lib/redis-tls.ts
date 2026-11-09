// lib/redis-tls.ts
// Conexão TLS com o Redis próprio da VPS.
//
// O Redis roda em servidor nosso, com certificado assinado por uma CA nossa
// (não há CA pública porque o host é um IP). Abaixo está o certificado
// PÚBLICO dessa CA — não é segredo: ele apenas permite ao CLIENTE verificar
// que está falando com o nosso servidor, impedindo man-in-the-middle.
//
// O worker (na própria VPS) segue em redis:// sem TLS: o tráfego não sai da
// máquina. Só a conexão externa (Vercel) usa rediss://.

export const REDIS_CA_CERT = `\
-----BEGIN CERTIFICATE-----
MIIFGTCCAwGgAwIBAgIUV3Cmyw4o/4oShZbiR/u/NQj8OjEwDQYJKoZIhvcNAQEL
BQAwHDEaMBgGA1UEAwwRd2hhdHNhcHAtcmVkaXMtY2EwHhcNMjYxMTA5MTYwMzQ2
WhcNMzYxMTA2MTYwMzQ2WjAcMRowGAYDVQQDDBF3aGF0c2FwcC1yZWRpcy1jYTCC
AiIwDQYJKoZIhvcNAQEBBQADggIPADCCAgoCggIBAOxBgpZ4m9gkOM/GIL3IS1ET
fUhig9Ao2/D8qv7KJVAL9q/oTshnB55C4rgRt4mCeFOj1nPvD+k33YVa8P45IWNR
/dEGECja3mlVTqkj7zRBWbcCZbGrq65Qh5ILRo40Yqd50pGHy+bFrDKWKVkL9Pum
aNkdImgs5eYipk+s15HjUe2WgU+63MOODvbe6wBLQOckdGdwmz4u/R3gPer0i/7k
eRhcJyZW7tANG+kNIvrqE7D6lPn6NmesFDvs+3fX8AyLq/2uod+LcXpUqjFFwoXM
ImqtiQieq9PZkBzhSr+LY/SahRqd0yUPrqujrDc8K8igOYdNUboKxE25jn3jNKax
UWq9dnz5I3+TnS9E8jzY5AbxijzBGRu4Nowmgv4HJHLxFU6okC5aGN0nbx1ZMrnb
cJSp2aNQxBd60VnbsIuYNzDtChv4HUOO+K2g7sLMHnX29JcFccPda9JZddMWs7qj
yZFDz+sZs7R6Jq9mLvzTSyptWMlP+4vrl9dbmZU2BHG32KdEjhMsxCBxNyZJ54j4
UfwKN0Y2C7Wxd3ydu1zMqEI2JG4SADVSoSPp5nxl6tRGP/kvZKGYuW9E4ePLuyvR
KiMxDWMeZvYHDCqiHr9Ixjn97Ub7aVHqivzFMBm06upGBnQLbLVe1agUJYmwb+lV
GENqfGBNg7Btzk4qAV2bAgMBAAGjUzBRMB0GA1UdDgQWBBTgKeN+yI6BeMm/uZHO
5bTt2LQ0bjAfBgNVHSMEGDAWgBTgKeN+yI6BeMm/uZHO5bTt2LQ0bjAPBgNVHRMB
Af8EBTADAQH/MA0GCSqGSIb3DQEBCwUAA4ICAQAN7Z8odXz7tIYYMXaEXmZM2NaP
I8geW3yK7olCD/z62q4kQi+dXJ5m96uWAo2BMuehEy7KYEXe1KsgaDMF1bzw9EdX
5br1IU95dn7vw5lG4Nl36HaePcxfgo+UQlnDJc15lhQNglW2UNHvPG5DyIHcGlxG
8Qw7FRCbCpte/2/T6OoM4ZiWf5O3QJZ1sJKMcOTSSWgeZGmIKsuVDHghny8I+pbz
+PiO8Q0NOH2jkQFZUlvHIMGlRz6B/6oYBIRNh6XbmuE+N7r67Jbl+GNvXuYG8HsB
DQUFn/COfCCCF2aCl/Z8mHzOlneKO9gbyzmKAKsotGqdOAWiOS0iW0FDZ1/+I5Gb
ekUWqfkIaWHExd15AYL4U5gPViIr5eDp+3h4Ol3Mwp5xBmt5oWhelc+1wBEvigWd
RBrH7PvxqtnUIn7VV40Kaf0DSdtGHXka/rPclZFnJjQpIq0qrklF4gsR1pxL+bRH
oqN2Z0eLNJI1zs87moMiKwD7hAm56wZRtq4VBCA5tmtUQ8xWCfZJWe4viHIM9yE/
6jfXXzwLM1DPZxxYXkYQy9MUPkcMkUX4Nu0spLWFppzH2yxQ2Wq2yU7YAAi8mpRm
F2+QF9hEr+ywdKsX6BR0hTUfzjBXAHpGZdd3jYaxg1yKBFl6AwR8KzO6vyoiHx1V
v2hfHggvcsLAcSsiaw==
-----END CERTIFICATE-----
`

// Só liga TLS quando a URL pedir (rediss://). Em redis:// (loopback) não faz nada.
export function redisTlsOptions(
  url: string | undefined = process.env.REDIS_URL
): { tls?: { ca: string[] } } {
  return url?.startsWith('rediss://') ? { tls: { ca: [REDIS_CA_CERT] } } : {}
}
