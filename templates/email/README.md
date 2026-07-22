# OTP email templates

Source language is **English**. Vietnamese and Traditional Chinese (Taiwan) are translations.

| Locale | File | `{{expiresIn}}` example |
| --- | --- | --- |
| `en` | [`otp.html`](./otp.html) | `10 minutes` |
| `vi` | [`otp.vi.html`](./otp.vi.html) | `10 phút` |
| `zh-TW` | [`otp.zh-TW.html`](./otp.zh-TW.html) | `10 分鐘` |

Shared placeholders: `{{fullName}}`, `{{otpCode}}`, `{{expiresIn}}`, `{{year}}`.

Pick the template by user locale when the mailer sends OTP.
