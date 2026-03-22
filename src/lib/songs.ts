export interface Song {
  id: string;
  title: string;
  artist: string;
  genre: string;
  difficulty: "easy" | "medium" | "hard";
  duration: string;
  bpm: number;
  cover: string;
  popular: boolean;
}

export const songs: Song[] = [
  { id: "1", title: "Tizita", artist: "Mahmoud Ahmed", genre: "Ethio-Jazz", difficulty: "easy", duration: "4:32", bpm: 85, cover: "", popular: true },
  { id: "2", title: "Ambassel", artist: "Aster Aweke", genre: "Traditional", difficulty: "medium", duration: "5:10", bpm: 92, cover: "", popular: true },
  { id: "3", title: "Yene Habesha", artist: "Teddy Afro", genre: "Pop", difficulty: "medium", duration: "3:45", bpm: 120, cover: "", popular: true },
  { id: "4", title: "Sew Mehed", artist: "Tilahun Gessesse", genre: "Classic", difficulty: "easy", duration: "4:15", bpm: 78, cover: "", popular: true },
  { id: "5", title: "Alchalkum", artist: "Teddy Afro", genre: "Pop", difficulty: "hard", duration: "4:50", bpm: 130, cover: "", popular: true },
  { id: "6", title: "Bati", artist: "Mulatu Astatke", genre: "Ethio-Jazz", difficulty: "hard", duration: "6:20", bpm: 110, cover: "", popular: true },
  { id: "7", title: "Yekermo Sew", artist: "Mulatu Astatke", genre: "Ethio-Jazz", difficulty: "medium", duration: "5:45", bpm: 95, cover: "", popular: false },
  { id: "8", title: "Ere Mela Mela", artist: "Mahmoud Ahmed", genre: "Traditional", difficulty: "easy", duration: "4:00", bpm: 88, cover: "", popular: false },
  { id: "9", title: "Munaye", artist: "Aster Aweke", genre: "Pop", difficulty: "medium", duration: "3:55", bpm: 115, cover: "", popular: false },
  { id: "10", title: "Janoy", artist: "Gigi", genre: "World", difficulty: "hard", duration: "5:30", bpm: 105, cover: "", popular: false },
  { id: "11", title: "Addis Abeba Bete", artist: "Mahmoud Ahmed", genre: "Ethio-Jazz", difficulty: "medium", duration: "4:40", bpm: 100, cover: "", popular: false },
  { id: "12", title: "Haile", artist: "Teddy Afro", genre: "Pop", difficulty: "easy", duration: "3:30", bpm: 118, cover: "", popular: false },
];

export const genres = ["All", "Ethio-Jazz", "Traditional", "Pop", "Classic", "World"];
export const difficulties = ["All", "easy", "medium", "hard"];
