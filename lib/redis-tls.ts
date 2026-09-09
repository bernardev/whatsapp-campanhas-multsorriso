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
MIIFZzCCA0+gAwIBAgIUIwD6kbPJYFqoO0AxiocBgj7fXywwDQYJKoZIhvcNAQEL
BQAwQzELMAkGA1UEBhMCQlIxFTATBgNVBAoMDE11bHQgU29ycmlzbzEdMBsGA1UE
AwwUTXVsdFNvcnJpc28gUmVkaXMgQ0EwHhcNMjYwOTA5MTUwNzQxWhcNMzYwOTA2
MTUwNzQxWjBDMQswCQYDVQQGEwJCUjEVMBMGA1UECgwMTXVsdCBTb3JyaXNvMR0w
GwYDVQQDDBRNdWx0U29ycmlzbyBSZWRpcyBDQTCCAiIwDQYJKoZIhvcNAQEBBQAD
ggIPADCCAgoCggIBAI/wu3/rA4pm7pmFYnqnrE/i7TRN9gcJqCYZnLgwnh2yZaTr
OKPPwl4S7VoTZABrG0HN03qrAszmGJpY2KCDKUSxXtkH5b+0x5H+qEKItKyjtiMN
1gd3hYXgv0Zv0nzjX3sHZ9v1mEAgdwlyQgkBlJdAor8ZLbcjxUdU0psMmfinKer0
7PsdIXqKmxMrLnw3k316EnRf9WPmKaE78tjHq2hC5eRKEX7WVusO2f7nDQ3cRiWM
zrZnIY0GWDVlft56J9E53wKKAMfFTEqsC2+V27EdV95BpsMv5RIoVPjqesgnBwQ8
H0k6hrAeYN4TXE82bGfJEt1Y1+LO+r96/TKr9fFD+Vo/Qflk6BfBN7S2XKP9cqNa
cGSFwAF7weUmGfwzTVzPTo8NuYDlMP9nxETNe5Vup1gu4IPDUXs+/dqt0ibSUP1m
kRvc5Mqc3SqHoqXu+Gmz4sCbencQ+cFenqBtqd2e5MyiIEYJXn5+Gyvusyh9/+Ns
SsllLh17w8YZ5XLjHeU4unlS8Ki9qTWHAsJQUqrn/s2nXYUhzDx+CKZUvNEYalgf
Lr1TnO1p4rSRTEVQ0fPJRhUjPIoFYDYTpJI3tFnMjoY9kL1r4RhXnnkbGXi9w7Zf
RtX/xtZVTJP4ONFGaN+GB4kF3Zvm/fXt/h1tytbW2ySdM19zLL3/EymWA/wPAgMB
AAGjUzBRMB0GA1UdDgQWBBQoHKxGmsTMwhcKFzokFfDIG9GMWjAfBgNVHSMEGDAW
gBQoHKxGmsTMwhcKFzokFfDIG9GMWjAPBgNVHRMBAf8EBTADAQH/MA0GCSqGSIb3
DQEBCwUAA4ICAQAmzxQjLV9VFiOvBXV5VdvKd5hF1McMi79j2/2bmouS8080fTta
LofbBu+Y6pNpIzMv+B9ae6NIhguBHVQ/2hwJPzv85tp7mS0cDS2+zHuKQQSf9DrO
ST64hNmbHUutJF+ZAfX8pZAFxDF4Askp+dw9JmA85rGvpBP+QkoKPH68fMF56D0z
T4ITWDWF7iGvvqRfctc1z9mPMLcjXMe3yyzAlLaHPa65xcDuNdxXcFjqI1tqLg4/
WOEy2CYEux2HfhD8515V89Aa6ZarLA2cxb77kKz/rHr7zc9mEgWBDs2iP8g0j1qW
E7YBt3dS00rWVK667NqEtywTG1dkrSWZqbcoWywPDFMxaDbCW8ExjJjAjRJInPF8
+QlWcXc8UyT7W4HIKCsxM8+GhhOBxJkBqVNKaI/Kvj3R+l1C9TERIllqbHz/h3H1
IX5uK3Ol9TH0ZakYCDlHFB6BwLgZuYzKmiD3UNN+Ni9Z0RVyg4Tx0MP7eKFwiAe0
aVbwQIPT0a1U4A844M8eR8i9DNeSdvi7pgd7AcmzSfAZqqjsIVbGdxaQOpMFu/RN
qVrc2j13I+YuE2fEyvTwpV2jxIrNeIL2vb62CqQeCoiX30MDt3jlZLiTqgJEyVPZ
OGxK0Q+7/p216xjA6myb3Y3VqtMA/daFpR3R7NAMFRsA5Bfj8p0jVtEIxw==
-----END CERTIFICATE-----
`

// Só liga TLS quando a URL pedir (rediss://). Em redis:// (loopback) não faz nada.
export function redisTlsOptions(
  url: string | undefined = process.env.REDIS_URL
): { tls?: { ca: string[] } } {
  return url?.startsWith('rediss://') ? { tls: { ca: [REDIS_CA_CERT] } } : {}
}
