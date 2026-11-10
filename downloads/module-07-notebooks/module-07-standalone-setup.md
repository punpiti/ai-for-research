# Module 7 — Standalone notebook setup

ชุด notebook นี้ไม่ใช้ environment หรือ package จากบทก่อนหน้า วิธีหลักคือคัดลอกคำสั่งเดียวจากหน้า
Module 7 ไปวางใน Terminal หรือ PowerShell ตัวติดตั้งจะเตรียมทุกอย่างให้ครบ

## วิธีหลัก: ตัวติดตั้ง Module 7

ตัวติดตั้งทำงานในโฟลเดอร์ `~/ai-for-research-workspace` และดำเนินการดังนี้

1. ดาวน์โหลด bootstrap script ด้วยเครื่องมือของ OS แล้วจึงเรียก script จากไฟล์ที่ดาวน์โหลด
2. ติดตั้ง `uv` ในระดับผู้ใช้เมื่อยังไม่มี โดยไม่เปลี่ยน global Python
3. สร้าง Python 3.12 environment ที่ `.venv-module07/`
4. ติดตั้ง JupyterLab, kernel และ package ของบทเรียนให้ครบ
5. ดาวน์โหลด notebook ฟอนต์ สมุดงาน และแบบฝึกจาก manifest พร้อมตรวจขนาดและ SHA-256
6. ตรวจ import และแสดง `FINAL_RESULT PASS` พร้อมคำสั่งเปิด JupyterLab

การติดตั้งซ้ำ reuse ไฟล์ที่ตรงกับ manifest หากไฟล์ผู้เรียนเปลี่ยนไปแล้ว จะไม่เขียนทับ แต่เก็บฉบับเผยแพร่
ล่าสุดไว้ใต้ `.course-updates/course-materials/module-07/`

หากเตรียม workspace ด้วยตัวติดตั้งหลักสูตร Module 1 แล้ว ตัวติดตั้งจะดาวน์โหลดชุดล่าสุดจากเว็บและเก็บไว้ที่
`course-materials/module-07/` โดยอัตโนมัติ ให้เปิด notebook จากโฟลเดอร์ `notebooks/` ในนั้นได้เลย
ไม่ต้องดาวน์โหลดซ้ำด้วยมือ หากเคยแก้ไฟล์เดิม ตัวติดตั้งจะไม่เขียนทับ แต่จะเก็บรุ่นใหม่ไว้ใต้
`.course-updates/course-materials/module-07/` เพื่อให้เปรียบเทียบและรวมงานเองได้

## Google Colab

1. ดาวน์โหลด `.ipynb` ที่ต้องการเรียน หรือดาวน์โหลด ZIP ทั้งชุดแล้วแตกไฟล์
2. อัปโหลด notebook ไปที่ Google Colab
3. เลือก **Runtime → Run all**
4. เซลล์ setup จะเตรียม core package และฟอนต์ Sarabun สำหรับกราฟภาษาไทยให้ครบอัตโนมัติ
5. หาก Colab แจ้งให้ restart runtime ให้ restart แล้วเลือก **Run all** อีกครั้ง
6. ดาวน์โหลดไฟล์ผลลัพธ์ออกจาก `/content/` ก่อนปิด runtime

## Advanced fallback: Micromamba

เปิด Terminal ในโฟลเดอร์ที่ดาวน์โหลดชุด notebook แล้วรัน:

```bash
micromamba create -f module-07-environment.yml
micromamba run -n ai-for-research-module07 python -m ipykernel install --user \
  --name ai-for-research-module07 --display-name "Python (AI for Research M07)"
micromamba run -n ai-for-research-module07 jupyter lab
```

เปิด notebook แล้วเลือก kernel `Python (AI for Research M07)` จากนั้นเลือก **Run All**

## Advanced fallback: Conda

```bash
conda env create -f module-07-environment.yml
conda run -n ai-for-research-module07 python -m ipykernel install --user \
  --name ai-for-research-module07 --display-name "Python (AI for Research M07)"
conda run -n ai-for-research-module07 jupyter lab
```

## Advanced fallback: Python environment ที่ผู้ดูแลจัดการเอง

วิธีนี้ใช้เมื่อผู้เรียนดูแล environment ของตนเองได้:

```bash
python -m pip install -r module-07-requirements.txt
python -m pip install "jupyterlab>=4,<5" "ipykernel>=6,<8"
python -m jupyter lab
```

เซลล์ setup ใน Part A, B และ C ยังตรวจ package ซ้ำก่อนทำงาน หาก package ขาดหรือรุ่นไม่รองรับ
เซลล์จะติดตั้งด้วย `sys.executable -m pip` เพื่อให้ลงใน Python ตัวเดียวกับ kernel ที่กำลังรัน

## Package ที่ติดตั้งเป็นแกนบังคับ

- NumPy
- pandas
- Matplotlib
- Seaborn
- Plotly
- Altair

Folium, Lets-Plot และ deck.gl/pydeck เป็นตัวอย่างเครื่องมือเฉพาะทางในบทเรียน แต่ notebook ชุดนี้ไม่มี
กิจกรรมที่เรียกใช้ จึงไม่ติดตั้งอัตโนมัติ
