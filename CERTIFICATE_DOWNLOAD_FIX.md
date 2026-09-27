# OSON PRAVA — Certificate Download Fix

Sertifikat yuklab olish oqimi yangilandi.

## Nimalar tuzatildi

- Sertifikat PDF endi asosiy oqimda server tomonda PDFKit orqali generatsiya qilinadi.
- Chrome va boshqa oddiy brauzerlarda `GET /api/certificate` orqali haqiqiy PDF yuklanadi.
- Telegram Mini App'da `Telegram.WebApp.downloadFile()` mavjud bo'lsa, Telegram'ning native downloader'i ishlatiladi.
- Eski Telegram clientlarda fallback sifatida PDF endpoint tashqi brauzerga ochiladi.
- Telegram Web iframe ichida HTML/DOM'dan PDF yasashga bog'liq eski oqim ishlatilmaydi.
- PDF `Content-Type: application/pdf` va `Content-Disposition: attachment` headerlari bilan qaytariladi.
- O'zbekcha belgilar va foydalanuvchi ismlari uchun DejaVu Sans fontlari server PDF'iga embed qilinadi.
- Client-side html2canvas/jsPDF faqat server endpoint vaqtincha ishlamasa fallback sifatida qoldirilgan.
- **(v3 tuzatish)** `Telegram.WebApp.downloadFile()` chaqirilishidan oldin endi `wa.isVersionAtLeast('8.0')` orqali haqiqiy Bot API versiyasi tekshiriladi. Muammo: `telegram-web-app.js` skripti `downloadFile` funksiyasini har doim mavjud qilib beradi, hatto klient uni real qo‘llab-quvvatlamasa ham — funksiya chaqirilgach hech qanday xato yoki callback qaytmasdan "jim" qolar edi, shu sabab tugma hech narsa qilmayotgandek ko‘rinardi. Endi bu holatda kod darhol (xuddi shu click ichida, foydalanuvchi gesture'ini yo‘qotmasdan) `redirectToExternalBrowserIfInTelegram()` fallback'iga o‘tadi.

## Tekshiruv

```bash
node --check js/certificate.js
node --check api/certificate.js
node --check server.js
node scratch/test_certificate_download.js
```

Deployment uchun `npm install` yoki Vercel dependency install jarayoni `package.json`dagi `pdfkit` va `qrcode` paketlarini o'rnatishi kerak.
