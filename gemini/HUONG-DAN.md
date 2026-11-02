# Vẽ dáng lễ Phật bằng Gemini

Mỗi y phục cần 4 dáng, nhìn **từ phía sau lưng** (giống nhân vật đang ngồi trong game):

| Dáng | Mô tả |
|---|---|
| 1 | Quỳ trên bồ đoàn, hai tay chắp trước ngực |
| 2 | Quỳ, hai tay chắp đưa lên trán (thấy khuỷu tay giơ ra hai bên, đầu ngón tay nhô trên đầu) |
| 3 | Đang cúi người xuống, khoảng nửa chừng, tay chắp hạ dần xuống sàn |
| 4 | Lạy sát đất: trán chạm sàn, hai bàn tay úp xuống sàn hai bên đầu, lưng cong tròn, thấy gót chân |

Y phục: `man` (nam áo lam), `woman` (nữ áo lam), `granny` (áo nâu), `nun` (ni cô), `monk` (sư thầy), `child` (chú tiểu).

## Cách làm

1. Mở Gemini, đính kèm ảnh mẫu của y phục đó trong thư mục này (`ref_man.png`, `ref_woman.png`…).
2. Dán câu lệnh bên dưới, thay `[NHÂN VẬT]` bằng mô tả của y phục.
3. Lưu ảnh vào `gemini/incoming/`, đặt tên:
   - `man.png` nếu cả 4 dáng nằm cạnh nhau trong một ảnh (trái → phải là dáng 1 → 4), hoặc
   - `man_1.png`, `man_2.png`, `man_3.png`, `man_4.png` nếu mỗi dáng một ảnh.
4. Chạy `python3 tools/import_pray.py` trong thư mục game. Công cụ tự xoá nền, tách và cắt hình, rồi báo y phục nào đã đủ 4 dáng.
5. Tải lại trang game. Y phục đủ 4 dáng sẽ lạy bằng hình mới; y phục còn thiếu vẫn dùng động tác cũ.

## Câu lệnh

```
Use the attached image as the exact style and character reference: same character, same clothes, same
colors, same painted cartoon style, same soft lighting, same round brown meditation cushion.

Draw 4 poses of this character in ONE horizontal row, left to right, evenly spaced with clear empty
space between them, all seen from directly BEHIND and slightly above (we see the back, not the face),
same size and same cushion size in every pose. Each pose is on the cushion:

1. Kneeling upright on the cushion, sitting on the heels, palms joined together in front of the chest
   (prayer hands), elbows slightly out to the sides.
2. Kneeling upright, joined palms raised to the forehead, elbows lifted out to the sides, fingertips
   just visible above the head.
3. Bending forward halfway from the hips, head lowered, joined hands moving down toward the floor.
4. Full prostration: forehead touching the floor in front of the knees, both palms flat on the floor
   on each side of the head, back rounded, head hidden behind the back, soles of the feet visible.

Character: [NHÂN VẬT]
Plain flat pure white background, no shadow on the background, no floor, no text, no frame.
```

Mô tả nhân vật (dán vào chỗ `[NHÂN VẬT]`):

- **man:** a young Vietnamese man with short black hair, wearing a light grey Buddhist robe (áo tràng lam) and grey trousers, barefoot
- **woman:** a young Vietnamese woman with long straight black hair down her back, wearing a long light grey Buddhist robe, barefoot
- **granny:** an elderly Vietnamese woman with grey hair in a bun, wearing a brown traditional jacket and dark brown trousers, barefoot
- **nun:** a Vietnamese Buddhist nun wearing a grey cap and a light grey robe
- **monk:** a Vietnamese Buddhist monk with a shaved head, wearing a brown-orange robe draped over one shoulder
- **child:** a small Vietnamese boy novice with short dark hair, wearing a light grey robe

## Mẹo

- Gemini hay vẽ mặt quay ra trước. Nếu bị vậy, nhắc lại: *"seen from behind, we must see the back of the head, not the face"*.
- Nếu 4 dáng không cùng cỡ hoặc bồ đoàn to nhỏ khác nhau, bảo nó vẽ lại cho đều. Game căn cỡ theo bồ đoàn.
- Nền nên là một màu trơn (trắng hoặc xanh lá). Nền có hoa văn hay bóng đổ sẽ khó xoá.
- Dáng nào chưa ưng thì vẽ lại riêng dáng đó, lưu `man_3.png` rồi chạy lại công cụ. File cũ cùng tên sẽ bị ghi đè.
