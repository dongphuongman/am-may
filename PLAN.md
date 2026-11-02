# Am Mây · Chánh điện online (hướng hiện tại, 2026-10-31)

Làm lại toàn bộ theo **Chánh Điện Tịnh Tâm** của Kent Juno (https://github.com/kentjuno/chanh-dien-online, giấy phép MIT):
chánh điện 2.5D trên tranh `hall.jpg`, nhân vật nhìn từ phía sau đi từ cửa vào, ngồi xuống bồ đoàn và tụng.
Hình, nhân vật, nhạc nền lấy từ repo đó (ghi công trong game; giấy phép ở `public/assets/LICENSE-chanh-dien-tinh-tam.txt`).
README gốc lưu ý: hình tạo bằng Google Flow, nhạc bằng Gemini → kiểm tra điều khoản nếu dùng thương mại.

Khác bản gốc: người chơi thật qua server (bản gốc là người xem TikTok/bot), cúng dường miễn phí có giới hạn
tần suất thay cho coin, lời nguyện có lọc, âm lịch + lễ hội + lịch chuông sớm/tụng kinh chung, mõ/chuông tổng hợp.

## Cấu trúc
- `public/seats.js` — 16 chỗ ngồi đúng 16 bồ đoàn vẽ trong tranh, thứ tự xếp chỗ, câu tụng, loại cúng dường (dùng chung client + server)
- `public/main.js` — canvas 1080×1920, hoạt cảnh đi/ngồi, hiệu ứng, mạng, giọng đọc, nhạc, âm lịch
- `public/audio.js`, `public/lunar.js` — giữ từ bản trước
- `server.js` — 6 phòng mặc định, mỗi phòng 16 chỗ, tự xếp chỗ, đổi chỗ, tụng, lễ, mõ, cúng dường + lời nguyện, chống spam

## Chưa làm
- Bộ phát TikTok LIVE (`live/` của bản gốc: overlay 9:16, đọc bình luận/quà, giọng đọc Edge)
- Thêm hoạt cảnh cho sư/ni/chú tiểu (hiện xuất hiện tại chỗ, không có hoạt cảnh đi)
