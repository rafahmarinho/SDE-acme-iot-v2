# OTA update code signing (T279)

`app.config.ts` requires `certs/certificate.pem`. Generate it with:

```
npx expo-updates codesigning:generate --key-output-directory ../../keys \
  --certificate-output-directory certs --certificate-validity-duration-years 10 \
  --certificate-common-name "ACME IoT"
```

Keep the **private key** out of the repository (the `keys/` directory is outside the app and must be stored
in a secrets manager / EAS secret). Only the public certificate is committed here.
