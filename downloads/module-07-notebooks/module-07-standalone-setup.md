# Module 7 — Standalone notebook setup

ชุด notebook นี้ไม่ใช้ environment หรือ package จากบทก่อนหน้า ผู้เรียนเลือกวิธีใดวิธีหนึ่งต่อไปนี้

หากเตรียม workspace ด้วยตัวติดตั้งหลักสูตรแล้ว ตัวติดตั้งจะดาวน์โหลดชุดล่าสุดจากเว็บและเก็บไว้ที่
`course-materials/module-07/` โดยอัตโนมัติ ให้เปิด notebook จากโฟลเดอร์ `notebooks/` ในนั้นได้เลย
ไม่ต้องดาวน์โหลดซ้ำด้วยมือ หากเคยแก้ไฟล์เดิม ตัวติดตั้งจะไม่เขียนทับ แต่จะเก็บรุ่นใหม่ไว้ใต้
`.course-updates/course-materials/module-07/` เพื่อให้เปรียบเทียบและรวมงานเองได้

## Google Colab

1. ดาวน์โหลด `.ipynb` ที่ต้องการเรียน หรือดาวน์โหลด ZIP ทั้งชุดแล้วแตกไฟล์
2. อัปโหลด notebook ไปที่ Google Colab
3. เลือก **Runtime → Run all**
4. เซลล์ setup แรกจะตรวจ package และรุ่น แล้วติดตั้ง core stack ที่ขาดหรือไม่อยู่ในช่วงที่รองรับ
5. หาก Colab แจ้งให้ restart runtime ให้ restart แล้วเลือก **Run all** อีกครั้ง
6. ดาวน์โหลดไฟล์ผลลัพธ์ออกจาก `/content/` ก่อนปิด runtime

## เครื่องของผู้เรียนด้วย Micromamba

เปิด Terminal ในโฟลเดอร์ที่ดาวน์โหลดชุด notebook แล้วรัน:

```bash
micromamba create -f module-07-environment.yml
micromamba run -n ai-for-research-module07 python -m ipykernel install --user \
  --name ai-for-research-module07 --display-name "Python (AI for Research M07)"
micromamba run -n ai-for-research-module07 jupyter lab
```

เปิด notebook แล้วเลือก kernel `Python (AI for Research M07)` จากนั้นเลือก **Run All**

## เครื่องของผู้เรียนด้วย Conda

```bash
conda env create -f module-07-environment.yml
conda run -n ai-for-research-module07 python -m ipykernel install --user \
  --name ai-for-research-module07 --display-name "Python (AI for Research M07)"
conda run -n ai-for-research-module07 jupyter lab
```

## Python environment ที่มีอยู่แล้ว

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
