import { demo as canonical, validate } from "../../src/domain.js";
export function promotionDemo() {
  const d = canonical();
  d.appVersion = "0.2.0";
  d.familyName = "Keluarga Wiratama";
  d.demo = true;
  const names = {
    A: [
      "Arif Wiratama",
      "Pensiunan guru",
      "Setiap Minggu pagi, Pak Arif merawat kebun kecilnya sambil memutar lagu keroncong. Ia mengajar matematika selama 35 tahun dan percaya bahwa meja makan adalah tempat belajar terbaik.",
      "Resep nasi goreng Bapak selalu memakai bawang putih yang digeprek, bukan dicincang.",
    ],
    B: [
      "Ratna Wiratama",
      "Perajin batik",
      "Ibu Ratna menyimpan cerita keluarga lewat kain. Motif daun pada batik buatannya terinspirasi halaman rumah masa kecil di Bandung. Ia membuka kelas membatik untuk cucu-cucunya setiap liburan.",
      "“Pulanglah sesering mungkin. Rumah tak pernah menghitung berapa lama kalian pergi.”",
    ],
    C: [
      "Candra Wiratama",
      "Arsitek",
      "Candra tumbuh dengan buku sketsa di tangannya. Setelah bekerja di Jakarta, ia merancang rumah-rumah yang memberi ruang bagi tiga generasi untuk berkumpul. Bersama Gita, ia membangun keluarga yang hangat bagi Hadi dan Intan.",
      "Kenangan favorit: perjalanan keluarga naik kereta ke Yogyakarta pada 2018.",
    ],
    D: [
      "Dimas Wiratama",
      "Pemilik kedai kopi",
      "Dimas membuka Kedai Sore di Bandung setelah bertahun-tahun bekerja di perhotelan. Ia mengenal hampir semua pelanggan lewat pesanan kopi mereka. Baginya, usaha kecil adalah cara merawat tetangga.",
      "Kedainya menjadi tempat pertemuan keluarga setiap akhir tahun.",
    ],
    E: [
      "Eka Wiratama",
      "Dokter anak",
      "Eka memilih tinggal di Yogyakarta untuk dekat dengan rumah sakit dan taman-taman kota. Ia senang membacakan cerita sebelum tidur dan mengumpulkan kartu pos dari setiap kota yang dikunjungi.",
      "Mimpi kecilnya: membuat perpustakaan keliling untuk anak-anak.",
    ],
    G: [
      "Gita Larasati",
      "Desainer tekstil",
      "Gita mencintai warna-warna alam. Ia adalah ibu biologis Hadi dari hubungan sebelumnya dan kemudian membangun keluarga bersama Candra. Bagi Gita, keluarga hadir lewat perhatian yang dirawat setiap hari.",
      "Ia menyimpan album foto bertema: satu halaman untuk setiap ulang tahun.",
    ],
    H: [
      "Hadi Pratama",
      "Mahasiswa desain produk",
      "Anak dari hubungan sebelumnya (biologis dari G). Hadi senang membuat benda dari kayu bekas. Candra adalah ayah tirinya, dan keduanya kerap menghabiskan akhir pekan memperbaiki sepeda.",
      "Proyek pertamanya adalah rak buku untuk Intan, dibuat bersama Candra.",
    ],
    I: [
      "Intan Wiratama",
      "Pelajar",
      "Intan gemar membaca novel petualangan dan belajar biola. Ia adalah anak biologis Candra dan Gita. Kakak Hadi selalu menjadi orang pertama yang mendengar lagu baru hasil latihannya.",
      "Ia ingin merekam semua cerita masa kecil Kakek dan Nenek.",
    ],
  };
  const indices = { A: 0, B: 1, C: 2, G: 3, D: 4, E: 5, H: 8, I: 9 };
  for (const p of d.persons) {
    const [name, occupation, bio, notes] = names[p.id];
    Object.assign(p, {
      name,
      occupation,
      bio,
      notes,
      photo: "/demo/portraits.png",
      photoIndex: indices[p.id],
    });
  }
  const extra = [
    [
      "J",
      "Nadia Kusuma",
      "1984-05-20",
      "female",
      "Bandung",
      "Guru bahasa",
      "Nadia menulis puisi pendek dan mengajar bahasa Indonesia. Bersama Dimas, ia mengajak anak-anak mengenal keluarga lewat cerita dan permainan. ",
      7,
    ],
    [
      "K",
      "Bima Adinata",
      "1982-12-10",
      "male",
      "Yogyakarta",
      "Fotografer",
      "Bima memotret kehidupan sehari-hari: tangan yang menyiapkan sarapan, sepeda di teras, dan tawa keluarga. Ia menikah dengan Eka dan mendokumentasikan pertumbuhan anak-anak mereka.",
      6,
    ],
    [
      "L",
      "Raka Wiratama",
      "2014-01-22",
      "male",
      "Bandung",
      "Pelajar",
      "Raka gemar bereksperimen dengan kamera lama milik pamannya. Ia menyukai sains dan bercita-cita membuat film dokumenter tentang alam.",
      10,
    ],
    [
      "M",
      "Lila Wiratama",
      "2017-08-14",
      "female",
      "Bandung",
      "Pelajar",
      "Lila selalu membawa buku gambar berwarna kuning. Ia menggambar kucing, rumah, dan wajah orang-orang yang paling disayanginya.",
      11,
    ],
    [
      "N",
      "Sari Adinata",
      "2001-11-09",
      "female",
      "Yogyakarta",
      "Ilustrator",
      "Sari membuat ilustrasi buku anak. Ia sering meminta Nenek Ratna bercerita tentang pasar tradisional sebagai inspirasi warna dan tokoh.",
      12,
    ],
    [
      "O",
      "Reza Mahendra",
      "1999-04-17",
      "male",
      "Semarang",
      "Insinyur lingkungan",
      "Reza bertemu Sari di kegiatan menanam pohon. Mereka berbagi kebiasaan menyimpan satu foto dan satu cerita dari setiap perjalanan.",
      13,
    ],
    [
      "P",
      "Nino Wiratama",
      "2019-09-30",
      "male",
      "Bandung",
      "Pelajar",
      "Nino bergabung dengan keluarga Dimas dan Nadia melalui adopsi. Ia suka dinosaurus, membangun menara balok, dan mengikuti Kakek ke kebun.",
      14,
    ],
    [
      "Q",
      "Maya Larasati",
      "1991-02-05",
      "female",
      "Jakarta",
      "Pustakawan",
      "Maya adalah adik Gita dan wali yang dipercaya keluarga untuk mendampingi Intan saat orang tuanya bekerja. Ia membuat klub baca kecil di lingkungan rumah.",
      15,
    ],
  ];
  for (const [
    id,
    name,
    birth,
    gender,
    place,
    occupation,
    bio,
    photoIndex,
  ] of extra)
    d.persons.push({
      id,
      name,
      birth,
      gender,
      place,
      occupation,
      bio,
      notes:
        "Profil dan cerita ini sepenuhnya fiktif untuk demonstrasi KinRoot.",
      death: "",
      photo: "/demo/portraits.png",
      photoIndex,
    });
  d.partnerships.push(
    {
      id: "DJ",
      personA: "D",
      personB: "J",
      type: "marriage",
      status: "current",
      date: "2009-05-16",
    },
    {
      id: "EK",
      personA: "E",
      personB: "K",
      type: "marriage",
      status: "current",
      date: "2000-07-22",
    },
    {
      id: "NO",
      personA: "N",
      personB: "O",
      type: "marriage",
      status: "current",
      date: "2025-08-16",
    },
  );
  const add = (p, c, type = "biological") =>
    d.parentChild.push({
      id: p + c + "-" + type,
      parentId: p,
      childId: c,
      type,
      status: "confirmed",
    });
  for (const c of ["L", "M"]) for (const p of ["D", "J"]) add(p, c);
  for (const p of ["E", "K"]) add(p, "N");
  for (const p of ["D", "J"]) add(p, "P", "adoption");
  add("Q", "I", "guardian");
  d.activity = [
    {
      id: "demo-1",
      text: "Album keluarga: cerita lintas tiga generasi",
      date: "2026-10-20T08:00:00.000Z",
    },
    {
      id: "demo-2",
      text: "Kenangan perjalanan dan kisah hidup dilengkapi",
      date: "2026-10-18T09:00:00.000Z",
    },
  ];
  return validate(d);
}
