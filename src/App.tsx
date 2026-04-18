/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import confetti from 'canvas-confetti';
import { 
  Trophy, Timer, Star, RefreshCw, Play, CheckCircle2, XCircle, 
  Cat, Dog, Rabbit, Bird, Fish, Turtle, User, 
  Book, Pen, Globe, Zap, ListChecks,
  Calculator, Shapes, Ruler, MessageSquare, Search, LayoutGrid
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { auth, db } from './firebase';
import { 
  signInWithPopup, 
  signInWithRedirect,
  GoogleAuthProvider, 
  onAuthStateChanged, 
  User as FirebaseUser 
} from 'firebase/auth';
import { collection, addDoc, getDocFromServer, doc } from 'firebase/firestore';

type Operator = '+' | '-' | 'x' | ':' | '>' | '<' | '=';
type GameMode = 'endless' | 'quiz';
type SubjectId = 'math' | 'vietnamese' | 'english';
type Grade = '2';

type Question = {
  type?: 'math' | 'text';
  num1?: number | string;
  num2?: number | string;
  operator?: string;
  answer?: string | number;
  q?: string;
  text?: string | React.ReactNode;
  ans?: string | number;
  opts?: (string | number)[];
  unit?: string;
};

const Fraction = ({ num, den }: { num: number | string, den: number | string }) => (
  <div className="inline-flex flex-col items-center align-middle mx-1">
    <div className="border-b-2 border-gray-700 px-1 text-center leading-none pb-0.5">{num}</div>
    <div className="text-center leading-none pt-0.5">{den}</div>
  </div>
);

const ANIMAL_ICONS = [
  { id: 'cat', Icon: Cat, color: 'text-orange-400', label: 'Mèo con' },
  { id: 'dog', Icon: Dog, color: 'text-amber-600', label: 'Cún con' },
  { id: 'rabbit', Icon: Rabbit, color: 'text-pink-400', label: 'Thỏ ngọc' },
  { id: 'bird', Icon: Bird, color: 'text-blue-400', label: 'Chim sáo' },
  { id: 'fish', Icon: Fish, color: 'text-cyan-400', label: 'Cá vàng' },
  { id: 'turtle', Icon: Turtle, color: 'text-green-400', label: 'Rùa con' },
];

const SUBJECTS = [
  { id: 'math', name: 'Toán Học', color: 'bg-orange-500', Icon: Book, desc: 'Cộng, trừ, nhân, chia...' },
  { id: 'vietnamese', name: 'Tiếng Việt', color: 'bg-blue-500', Icon: Pen, desc: 'Chính tả, từ vựng...' },
  { id: 'english', name: 'Tiếng Anh', color: 'bg-green-500', Icon: Globe, desc: 'Colors, Animals, Numbers...' }
];

const MATH_TOPICS_G2 = [
  { id: 'calc_3_digit', name: 'Phép tính 3 chữ số', desc: 'Cộng, trừ <1000; nhân, chia', Icon: Calculator, color: 'text-orange-500' },
  { id: 'geometry', name: 'Hình học', desc: 'Đếm hình tam giác, tứ giác', Icon: Shapes, color: 'text-blue-500' },
  { id: 'special_numbers', name: 'Số học đặc biệt', desc: 'Số lớn nhất, số bé nhất', Icon: Star, color: 'text-yellow-500' },
  { id: 'measurement', name: 'Đo lường', desc: 'm, dm, cm', Icon: Ruler, color: 'text-green-500' },
  { id: 'word_problems', name: 'Giải toán có lời văn', desc: 'Bài toán đố vui', Icon: MessageSquare, color: 'text-purple-500' },
  { id: 'find_x', name: 'Tìm X', desc: 'Tìm số chưa biết', Icon: Search, color: 'text-red-500' },
  { id: 'all', name: 'Tất cả chủ đề', desc: 'Luyện tập tổng hợp', Icon: LayoutGrid, color: 'text-gray-500' }
];

const VIETNAMESE_DATA = [
  { q: "Điền vào chỗ trống: 'ng' hay 'ngh'?", text: "...e nhạc", ans: "ngh", opts: ["ng", "ngh"] },
  { q: "Từ nào viết đúng chính tả?", text: "", ans: "con kiến", opts: ["con kiến", "con kiên"] },
  { q: "Từ trái nghĩa với 'Nóng' là gì?", text: "", ans: "Lạnh", opts: ["Ấm", "Lạnh", "Mát"] },
  { q: "Điền chữ cái: 'g' hay 'gh'?", text: "...à trống", ans: "g", opts: ["g", "gh"] },
  { q: "Từ đồng nghĩa với 'Học tập' là gì?", text: "", ans: "Học hành", opts: ["Học hành", "Vui chơi", "Chạy nhảy"] },
  { q: "Con gì kêu 'Quác quác'?", text: "", ans: "Con vịt", opts: ["Con gà", "Con vịt", "Con mèo"] },
  { q: "Điền vào chỗ trống: 'c' hay 'k'?", text: "con ...im", ans: "c", opts: ["c", "k"] },
  { q: "Điền vào chỗ trống: 'ch' hay 'tr'?", text: "...ung thu", ans: "tr", opts: ["ch", "tr"] },
  { q: "Điền vào chỗ trống: 'd', 'r' hay 'gi'?", text: "...a đình", ans: "gi", opts: ["d", "r", "gi"] },
  { q: "Điền vào chỗ trống: 's' hay 'x'?", text: "...inh đẹp", ans: "x", opts: ["s", "x"] },
  { q: "Dấu câu nào dùng để kết thúc câu kể?", text: "", ans: "Dấu chấm", opts: ["Dấu chấm", "Dấu hỏi", "Dấu phẩy"] },
  { q: "Dấu câu nào dùng để kết thúc câu hỏi?", text: "", ans: "Dấu hỏi", opts: ["Dấu chấm", "Dấu hỏi", "Dấu chấm than"] },
  { q: "Từ nào chỉ nghề nghiệp?", text: "", ans: "Bác sĩ", opts: ["Bác sĩ", "To lớn", "Chạy nhảy"] },
  { q: "Từ nào chỉ sự vật?", text: "", ans: "Cái cặp", opts: ["Cái cặp", "Chạy bộ", "Vui vẻ"] },
  { q: "Câu nào là câu nêu đặc điểm?", text: "", ans: "Bé rất ngoan.", opts: ["Bé rất ngoan.", "Bé đang học bài.", "Bé là học sinh."] },
  { q: "Từ nào viết đúng chính tả?", text: "", ans: "nghỉ ngơi", opts: ["nghỉ ngơi", "ngỉ ngơi"] },
  { q: "Từ nào viết đúng chính tả?", text: "", ans: "quả cam", opts: ["quả cam", "quả kam"] },
  { q: "Điền vào chỗ trống: 'l' hay 'n'?", text: "quả ...ê", ans: "l", opts: ["l", "n"] },
  { q: "Điền vào chỗ trống: 'i' hay 'iê'?", text: "con k...n", ans: "iê", opts: ["i", "iê"] },
  { q: "Điền vào chỗ trống: 's' hay 'x'?", text: "...ông núi", ans: "s", opts: ["s", "x"] },
  { q: "Từ nào chỉ hoạt động?", text: "", ans: "Quét nhà", opts: ["Quét nhà", "Cái chổi", "Sạch sẽ"] },
  { q: "Từ nào chỉ đặc điểm?", text: "", ans: "Thông minh", opts: ["Học bài", "Thông minh", "Bút chì"] },
  { q: "Câu 'Mẹ em là giáo viên' thuộc kiểu câu nào?", text: "", ans: "Ai là gì?", opts: ["Ai làm gì?", "Ai thế nào?", "Ai là gì?"] },
  { q: "Điền vào chỗ trống: 'i' hay 'y'?", text: "v...ết chữ", ans: "i", opts: ["i", "y"] },
  { q: "Từ trái nghĩa với 'Cao' là gì?", text: "", ans: "Thấp", opts: ["To", "Thấp", "Dài"] },
  { q: "Điền vần 'ên' hay 'ênh'?", text: "b... nước", ans: "ên", opts: ["ên", "ênh"] },
  { q: "Điền vần 'ên' hay 'ênh'?", text: "nhẹ t...", ans: "ênh", opts: ["ên", "ênh"] },
  { q: "Điền vần 'ên' hay 'ênh'?", text: "mũi t...", ans: "ên", opts: ["ên", "ênh"] },
  { q: "Điền vần 'ên' hay 'ênh'?", text: "l... xuống", ans: "ên", opts: ["ên", "ênh"] },
  { q: "Điền vần 'ên' hay 'ênh'?", text: "b... vững", ans: "ên", opts: ["ên", "ênh"] },
  { q: "Điền vần 'ên' hay 'ênh'?", text: "m... mông", ans: "ênh", opts: ["ên", "ênh"] },
  { q: "Từ nào viết ĐÚNG chính tả?", text: "", ans: "máy bay", opts: ["máy bay", "mái bay"] },
  { q: "Từ nào viết ĐÚNG chính tả?", text: "", ans: "máy tính", opts: ["máy tính", "mái tính"] },
  { q: "Từ nào viết ĐÚNG chính tả?", text: "", ans: "báo chí", opts: ["báo chí", "bái chí"] },
  { q: "Từ nào viết ĐÚNG chính tả?", text: "", ans: "bản đồ", opts: ["bản đồ", "bản đồ"] },
  { q: "Từ nào viết ĐÚNG chính tả?", text: "", ans: "kính mắt", opts: ["kính mắt", "kính măt"] },
  { q: "Từ nào viết ĐÚNG chính tả?", text: "", ans: "ti vi", opts: ["ti vi", "ty vy"] },
  { q: "Điền vần 'iên' hay 'iêng'?", text: "c... trì", ans: "iên", opts: ["iên", "iêng"] },
  { q: "Điền vần 'iên' hay 'iêng'?", text: "s... năng", ans: "iêng", opts: ["iên", "iêng"] },
  { q: "Điền vần 'uân' hay 'uâng'?", text: "mùa x...", ans: "uân", opts: ["uân", "uâng"] },
  { q: "Điền vào chỗ trống: 'd' hay 'gi'?", text: "...ày dép", ans: "gi", opts: ["d", "gi"] },
  { q: "Từ nào viết đúng chính tả?", text: "", ans: "trường học", opts: ["trường học", "chường học"] },
  { q: "Con gì gáy 'O ó o'?", text: "", ans: "Con gà trống", opts: ["Con vịt", "Con gà trống", "Con mèo"] },
  { q: "Điền vào chỗ trống: 'ua' hay 'uô'?", text: "m...a sắm", ans: "ua", opts: ["ua", "uô"] },
  { q: "Điền vào chỗ trống: 'ua' hay 'uô'?", text: "b...ốn bán", ans: "uô", opts: ["ua", "uô"] },
  { q: "Từ nào chỉ người trong gia đình?", text: "", ans: "Ông nội", opts: ["Ông nội", "Bác sĩ", "Bạn bè"] },
  { q: "Dấu câu nào dùng để ngăn cách các ý trong câu?", text: "", ans: "Dấu phẩy", opts: ["Dấu chấm", "Dấu phẩy", "Dấu hỏi"] },
  { q: "Từ đồng nghĩa với 'Đẹp'?", text: "", ans: "Xinh", opts: ["Xinh", "Xấu", "Bẩn"] },
  { q: "Con gì có vòi dài?", text: "", ans: "Con voi", opts: ["Con voi", "Con kiến", "Con hươu"] },
  { q: "Điền vào chỗ trống: 'ai' hay 'ay'?", text: "bàn t... ", ans: "ay", opts: ["ai", "ay"] },
  { q: "Tìm từ trái nghĩa với 'Siêng năng'?", text: "", ans: "Lười biếng", opts: ["Lười biếng", "Chăm chỉ", "Ngoan ngoãn"] },
  { q: "Điền vào chỗ trống: 'l' hay 'n'?", text: "...o lắng", ans: "l", opts: ["l", "n"] },
  { q: "Từ nào chỉ tình cảm gia đình?", text: "", ans: "Yêu thương", opts: ["Yêu thương", "Chạy nhảy", "Cái bàn"] },
  { q: "Điền vào chỗ trống: 'c' hay 'k'?", text: "thước ...ẻ", ans: "k", opts: ["c", "k"] },
  { q: "Từ nào là từ chỉ con vật?", text: "", ans: "Con sóc", opts: ["Con sóc", "Cây bàng", "Bông hoa"] },
  { q: "Từ nào chỉ môn học?", text: "", ans: "Toán học", opts: ["Toán học", "Cái bút", "Chạy bộ"] },
  { q: "Điền vào chỗ trống: 'an' hay 'ang'?", text: "con s... ", ans: "ang", opts: ["an", "ang"] },
  { q: "Từ nào viết đúng chính tả?", text: "", ans: "con ghẹ", opts: ["con ghẹ", "con gẹ"] },
  { q: "Điền vào chỗ trống: 'ng' hay 'ngh'?", text: "suy ...ĩ", ans: "ngh", opts: ["ng", "ngh"] },
  { q: "Từ nào chỉ đồ dùng học tập?", text: "", ans: "Thước kẻ", opts: ["Thước kẻ", "Cái ghế", "Cái bát"] },
  { q: "Trong câu 'Em đang học bài', từ nào là động từ?", text: "", ans: "học bài", opts: ["Em", "đăng", "học bài"] },
  { q: "Trong câu 'Bông hoa rất đẹp', từ nào là tính từ?", text: "", ans: "đẹp", opts: ["Bông hoa", "rất", "đẹp"] },
  { q: "Câu 'Bố em là bác sĩ' thuộc kiểu câu nào?", text: "", ans: "Ai là gì?", opts: ["Ai là gì?", "Ai làm gì?", "Ai thế nào?"] },
  { q: "Câu 'Chú chim đang hót líu lo' thuộc kiểu câu nào?", text: "", ans: "Ai làm gì?", opts: ["Ai là gì?", "Ai làm gì?", "Ai thế nào?"] },
  { q: "Câu 'Bầu trời hôm nay rất xanh' thuộc kiểu câu nào?", text: "", ans: "Ai thế nào?", opts: ["Ai là gì?", "Ai làm gì?", "Ai thế nào?"] },
  { q: "Tìm danh từ trong câu: 'Con mèo đang ngủ.'", text: "", ans: "Con mèo", opts: ["Con mèo", "đang", "ngủ"] },
  { q: "Tìm động từ trong câu: 'Bé chạy tung tăng.'", text: "", ans: "chạy", opts: ["Bé", "chạy", "tung tăng"] },
  { q: "Tìm tính từ trong câu: 'Ngôi nhà rất cao.'", text: "", ans: "cao", opts: ["Ngôi nhà", "rất", "cao"] },
  { q: "Từ nào là danh từ chỉ người?", text: "", ans: "Kỹ sư", opts: ["Kỹ sư", "Chạy bộ", "Xanh ngắt"] },
  { q: "Từ nào là danh từ chỉ vật?", text: "", ans: "Cái bàn", opts: ["Cái bàn", "Thông minh", "Hát ca"] },
  { q: "Từ nào là danh từ chỉ con vật?", text: "", ans: "Con hổ", opts: ["Con hổ", "Cái cây", "Vui vẻ"] },
  { q: "Từ nào là danh từ chỉ cây cối?", text: "", ans: "Cây bàng", opts: ["Cây bàng", "Con cá", "Đỏ rực"] },
  { q: "Từ nào là động từ chỉ hoạt động di chuyển?", text: "", ans: "Đi bộ", opts: ["Đi bộ", "Cái ghế", "Hiền lành"] },
  { q: "Từ nào là tính từ chỉ màu sắc?", text: "", ans: "Vàng tươi", opts: ["Vàng tươi", "Nhảy múa", "Cái cặp"] },
  { q: "Từ nào là tính từ chỉ tính cách?", text: "", ans: "Ngoan ngoãn", opts: ["Ngoan ngoãn", "Cái bút", "Đọc sách"] },
  { q: "Chủ ngữ trong câu 'Mẹ em nấu cơm rất ngon' là gì?", text: "", ans: "Mẹ em", opts: ["Mẹ em", "nấu cơm", "rất ngon"] },
  { q: "Vị ngữ trong câu 'Đàn chim bay về phương nam' là gì?", text: "", ans: "bay về phương nam", opts: ["Đàn chim", "bay về phương nam", "bay"] },
  { q: "Từ nào là từ chỉ sự vật?", text: "", ans: "Quyển vở", opts: ["Quyển vở", "Chăm chỉ", "Quét dọn"] },
  { q: "Từ nào là từ chỉ hoạt động?", text: "", ans: "Tưới cây", opts: ["Tưới cây", "Bông hoa", "Thơm ngát"] },
  { q: "Từ nào là từ chỉ đặc điểm?", text: "", ans: "Mềm mại", opts: ["Mềm mại", "Con thỏ", "Ăn cỏ"] },
  { q: "Điền từ thích hợp: 'Em ... bài tập về nhà.'", text: "", ans: "làm", opts: ["làm", "ăn", "ngủ"] },
  { q: "Điền từ thích hợp: 'Con voi có cái vòi ...'", text: "", ans: "dài", opts: ["dài", "ngắn", "nhỏ"] },
  { q: "Điền từ thích hợp: 'Bầu trời đêm có nhiều ... lấp lánh.'", text: "", ans: "ngôi sao", opts: ["ngôi sao", "đám mây", "mặt trời"] },
  { q: "Câu nào có dấu phẩy đặt đúng vị trí?", text: "", ans: "Em thích ăn táo, cam và quýt.", opts: ["Em thích ăn táo, cam và quýt.", "Em thích ăn táo cam, và quýt.", "Em thích ăn táo cam và, quýt."] },
  { q: "Từ nào đồng nghĩa với 'Chăm chỉ'?", text: "", ans: "Cần cù", opts: ["Cần cù", "Lười biếng", "Nhanh nhẹn"] },
  { q: "Từ nào trái nghĩa với 'Đoàn kết'?", text: "", ans: "Chia rẽ", opts: ["Chia rẽ", "Gắn bó", "Thương yêu"] },
  { q: "Từ nào là từ ghép?", text: "", ans: "Học sinh", opts: ["Học sinh", "Xanh xanh", "Nho nhỏ"] },
  { q: "Từ nào là từ láy?", text: "", ans: "Long lanh", opts: ["Long lanh", "Bàn ghế", "Sách vở"] },
  { q: "Bộ phận nào trả lời cho câu hỏi 'Ai?' trong câu 'Bác bảo vệ đang đánh trống'?", text: "", ans: "Bác bảo vệ", opts: ["Bác bảo vệ", "đang đánh trống", "đánh trống"] },
  { q: "Bộ phận nào trả lời cho câu hỏi 'Làm gì?' trong câu 'Đàn gà đang ăn thóc'?", text: "", ans: "đang ăn thóc", opts: ["Đàn gà", "đang ăn thóc", "ăn thóc"] },
  { q: "Bộ phận nào trả lời cho câu hỏi 'Thế nào?' trong câu 'Dòng sông xanh biếc'?", text: "", ans: "xanh biếc", opts: ["Dòng sông", "xanh biếc", "xanh"] },
  { q: "Từ nào chỉ nghề nghiệp?", text: "", ans: "Công nhân", opts: ["Công nhân", "Chạy nhảy", "To lớn"] },
  { q: "Từ nào chỉ thời gian?", text: "", ans: "Buổi sáng", opts: ["Buổi sáng", "Cái đồng hồ", "Chậm chạp"] },
  { q: "Từ nào chỉ địa điểm?", text: "", ans: "Công viên", opts: ["Công viên", "Vui chơi", "Đông đúc"] },
  { q: "Dấu câu nào dùng để liệt kê?", text: "", ans: "Dấu phẩy", opts: ["Dấu phẩy", "Dấu chấm", "Dấu chấm hỏi"] },
  { q: "Câu 'Ôi, bông hoa đẹp quá!' là kiểu câu gì?", text: "", ans: "Câu cảm", opts: ["Câu cảm", "Câu kể", "Câu hỏi"] },
  { q: "Câu 'Bạn tên là gì?' là kiểu câu gì?", text: "", ans: "Câu hỏi", opts: ["Câu hỏi", "Câu kể", "Câu khiến"] },
  { q: "Câu 'Hãy đóng cửa lại!' là kiểu câu gì?", text: "", ans: "Câu khiến", opts: ["Câu khiến", "Câu kể", "Câu cảm"] },
  { q: "Từ nào viết đúng chính tả?", text: "", ans: "trung thực", opts: ["trung thực", "chung thực"] },
  { q: "Từ nào viết đúng chính tả?", text: "", ans: "giúp đỡ", opts: ["giúp đỡ", "dúp đỡ"] },
  { q: "Từ nào viết đúng chính tả?", text: "", ans: "rực rỡ", opts: ["rực rỡ", "dực dỡ"] },
  { q: "Từ nào chỉ hoạt động của con vật?", text: "", ans: "Bay lượn", opts: ["Bay lượn", "Cái cánh", "Xinh xắn"] },
  { q: "Từ nào chỉ bộ phận cơ thể người?", text: "", ans: "Đôi mắt", opts: ["Đôi mắt", "Nhìn ngắm", "Long lanh"] },
  { q: "Từ nào chỉ thời tiết?", text: "", ans: "Nắng ráo", opts: ["Nắng ráo", "Cái ô", "Đi chơi"] },
  { q: "Từ nào chỉ cảm xúc?", text: "", ans: "Hạnh phúc", opts: ["Hạnh phúc", "Cười nói", "Món quà"] },
  { q: "Tìm từ chỉ sự vật trong câu: 'Mùa xuân đã về.'", text: "", ans: "Mùa xuân", opts: ["Mùa xuân", "đã", "về"] },
  { q: "Tìm từ chỉ hoạt động trong câu: 'Gió thổi mạnh.'", text: "", ans: "thổi", opts: ["Gió", "thổi", "mạnh"] },
  { q: "Tìm từ chỉ đặc điểm trong câu: 'Quả táo chín đỏ.'", text: "", ans: "đỏ", opts: ["Quả táo", "chín", "đỏ"] },
  { q: "Điền vào chỗ trống: '... em là học sinh lớp 2.'", text: "", ans: "Em", opts: ["Em", "Mẹ", "Bố"] },
  { q: "Từ nào là từ chỉ người thân?", text: "", ans: "Dì", opts: ["Dì", "Bạn", "Thầy"] },
  { q: "Câu nào là câu kể?", text: "", ans: "Hôm nay trời rất đẹp.", opts: ["Hôm nay trời rất đẹp.", "Trời hôm nay thế nào?", "Đẹp quá!"] },
  { q: "Từ nào đồng nghĩa với 'Mau chóng'?", text: "", ans: "Nhanh nhẹn", opts: ["Nhanh nhẹn", "Chậm chạp", "Lười biếng"] },
];

const ENGLISH_QUESTIONS_DATA: Question[] = [
  // Means of Transport
  { q: "I go to school by ___. The bus is yellow.", ans: "bus", opts: ["bus", "bicycle", "car", "truck"] },
  { q: "My ___ is red. I go to school by it.", ans: "bicycle", opts: ["bicycle", "motorcycle", "car", "truck"] },
  { q: "A ___ can carry many people in the city.", ans: "bus", opts: ["bus", "motorcycle", "bicycle", "truck"] },
  { q: "A ___ has four wheels and is for a small family.", ans: "car", opts: ["car", "bus", "truck", "bicycle"] },
  { q: "A ___ is very big and carries heavy things.", ans: "truck", opts: ["truck", "bicycle", "motorcycle", "bus"] },
  { q: "I use a ___ to travel in the sky.", ans: "plane", opts: ["plane", "boat", "car", "bus"] },

  // Foods
  { q: "___ is a common green vegetable.", ans: "Cabbage", opts: ["Cabbage", "Fish", "Orange", "Rice"] },
  { q: "We eat ___ every day. It's white and small.", ans: "Rice", opts: ["Rice", "Fish", "Cabbage", "Orange"] },
  { q: "An ___ is a round fruit and colored orange.", ans: "Orange", opts: ["Orange", "Rice", "Fish", "Cabbage"] },
  { q: "A ___ lives in the water and is a food.", ans: "Fish", opts: ["Fish", "Rice", "Cabbage", "Orange"] },
  { q: "Which one is a vegetable?", ans: "Cabbage", opts: ["Cabbage", "Orange", "Fish", "Rice"] },
  { q: "Which one is a fruit?", ans: "Orange", opts: ["Orange", "Cabbage", "Fish", "Rice"] },
  { q: "Spelling: C_bb_ge", ans: "Cabbage", opts: ["Cabbage", "Cabage", "Cabbige", "Cabbige"] },
  { q: "Spelling: O_an_e", ans: "Orange", opts: ["Orange", "Oranje", "Orenge", "Orangee"] },
  { q: "A ___ is white and we eat it in a bowl.", ans: "Rice", opts: ["Rice", "Fish", "Orange", "Cabbage"] },

  // Land Habitats
  { q: "Where do pine trees live?", ans: "forest", opts: ["forest", "desert", "mountain", "ocean"] },
  { q: "A very dry place with lots of sand is a ___.", ans: "desert", opts: ["desert", "forest", "grassland", "river"] },
  { q: "Cactuses live in the ___.", ans: "desert", opts: ["desert", "mountain", "forest", "pond"] },
  { q: "High land with cold peaks is called a ___.", ans: "mountain", opts: ["mountain", "desert", "swamp", "grassland"] },
  { q: "Flat land with lots of green grass is a ___.", ans: "grassland", opts: ["grassland", "forest", "desert", "ocean"] },
  { q: "Ferns can live in the ___.", ans: "mountains", opts: ["mountains", "forest", "desert", "pond"] },
  { q: "Which habitat has many trees?", ans: "forest", opts: ["forest", "desert", "mountain", "ocean"] },
  { q: "Which habitat is very hot and dry?", ans: "desert", opts: ["desert", "forest", "mountain", "swamp"] },
  { q: "Which habitat has grass for animals to eat?", ans: "grassland", opts: ["grassland", "desert", "mountain", "river"] },
  { q: "Which habitat is very high?", ans: "mountain", opts: ["mountain", "swamp", "pond", "ocean"] },

  // Aquatic Habitats
  { q: "A large body of salt water is the ___.", ans: "ocean", opts: ["ocean", "pond", "river", "swamp"] },
  { q: "A small body of still water is a ___.", ans: "pond", opts: ["pond", "ocean", "river", "desert"] },
  { q: "A long, flowing body of water is a ___.", ans: "river", opts: ["river", "pond", "swamp", "mountain"] },
  { q: "A wet area with water and many plants is a ___.", ans: "swamp", opts: ["swamp", "ocean", "desert", "mountain"] },
  { q: "Where do octopuses live?", ans: "ocean", opts: ["ocean", "pond", "river", "swamp"] },
  { q: "Where do goldfish live?", ans: "pond", opts: ["pond", "desert", "mountain", "forest"] },
  { q: "Where do cactuses NOT live?", ans: "ocean", opts: ["ocean", "desert", "land", "mountain"] },
  { q: "Water lilies live in the ___.", ans: "pond", opts: ["pond", "desert", "mountain", "forest"] },
  { q: "The ___ is a very deep aquatic habitat.", ans: "ocean", opts: ["ocean", "pond", "puddle", "well"] },
  { q: "Small fish often live in a ___.", ans: "pond", opts: ["pond", "ocean", "desert", "sky"] },

  // Plants
  { q: "___ live in the forest.", ans: "Pine trees", opts: ["Pine trees", "Cactuses", "Lotus", "Seagrass"] },
  { q: "___ is a plant that floats on water.", ans: "Duckweed", opts: ["Duckweed", "Pine tree", "Fern", "Cactus"] },
  { q: "___ lives in the ocean under water.", ans: "Seagrass", opts: ["Seagrass", "Lotus", "Pine tree", "Grass"] },
  { q: "A ___ is a beautiful flower in the pond.", ans: "lotus", opts: ["lotus", "cactus", "fern", "pine tree"] },
  { q: "___ live in the desert.", ans: "Cactuses", opts: ["Cactuses", "Pine trees", "Ferns", "Duckweed"] },
  { q: "___ can live in the mountains.", ans: "Ferns", opts: ["Ferns", "Cactuses", "Seagrass", "Lotus"] },
  { q: "Which plant is an aquatic plant?", ans: "Lotus", opts: ["Lotus", "Pine Tree", "Fern", "Cactus"] },
  { q: "Which plant is a land plant?", ans: "Cactus", opts: ["Cactus", "Water Lily", "Seagrass", "Duckweed"] },
  { q: "Missing letters: L_t_s", ans: "Lotus", opts: ["Lotus", "Latas", "Letes", "Lutus"] },
  { q: "Spelling: C_ct_s", ans: "Cactus", opts: ["Cactus", "Cactis", "Cactes", "Cactas"] },

  // Animals
  { q: "The forest is the habitat for the ___.", ans: "monkey", opts: ["monkey", "camel", "octopus", "fish"] },
  { q: "___ have wings and can live in different habitats.", ans: "Butterflies", opts: ["Butterflies", "Monkeys", "Camels", "Fish"] },
  { q: "Deer live in the ___.", ans: "grassland", opts: ["grassland", "forest", "desert", "ocean"] },
  { q: "Camels live in the ___.", ans: "desert", opts: ["desert", "swamp", "pond", "river"] },
  { q: "An ___ has eight arms and lives in the ocean.", ans: "octopus", opts: ["octopus", "goldfish", "monkey", "deer"] },
  { q: "A ___ looks like a horse in the water.", ans: "seahorse", opts: ["seahorse", "catfish", "goldfish", "monkey"] },
  { q: "Monkeys live in the ___.", ans: "forest", opts: ["forest", "desert", "grassland", "ocean"] },
  { q: "___ live in a pond and are golden.", ans: "Goldfish", opts: ["Goldfish", "Octopus", "Butterfly", "Camel"] },
  { q: "Which animal lives on land?", ans: "Deer", opts: ["Deer", "Octopus", "Seahorse", "Goldfish"] },
  { q: "Which animal lives in water?", ans: "Catfish", opts: ["Catfish", "Monkey", "Butterfly", "Camel"] },

  // Human Body
  { q: "The frame of bones in our body is the ___.", ans: "skeleton", opts: ["skeleton", "muscle", "joint", "skin"] },
  { q: "The ___ is the bone in our back.", ans: "spine", opts: ["spine", "skull", "joint", "rib cage"] },
  { q: "The ___ protects our heart and lungs.", ans: "rib cage", opts: ["rib cage", "skull", "spine", "joint"] },
  { q: "The ___ is the bone that protects our brain.", ans: "skull", opts: ["skull", "spine", "rib cage", "muscle"] },
  { q: "A ___ is where two bones meet.", ans: "joint", opts: ["joint", "muscle", "spine", "skull"] },
  { q: "___ help our body to move.", ans: "Muscles", opts: ["Muscles", "Bones", "Nails", "Hair"] },
  { q: "How many joints are in our body?", ans: "Many", opts: ["Many", "One", "Two", "None"] },
  { q: "The ___ protects our body and brain.", ans: "skeleton", opts: ["skeleton", "clothes", "shoes", "hats"] },
  { q: "Spelling: S_u_l", ans: "Skull", opts: ["Skull", "Skul", "Skoll", "Skulle"] },
  { q: "Spelling: M_sc_e", ans: "Muscle", opts: ["Muscle", "Muscel", "Musle", "Musclee"] },

  // Human Body Part 2
  { q: "Missing letter: Skelet_n", ans: "o", opts: ["o", "a", "u", "i"] },
  { q: "Missing letter: Spin_", ans: "e", opts: ["e", "a", "i", "o"] },
  { q: "Missing letter: _rib cage", ans: "R", opts: ["R", "B", "D", "S"] },
  { q: "Missing letter: Skull_", ans: "l", opts: ["l", "b", "g", "k"] },
  { q: "The skull, rib cage and spine are in the ___.", ans: "skeleton", opts: ["skeleton", "muscles", "joints", "skin"] },
  { q: "___ are where bones meet.", ans: "Joints", opts: ["Joints", "Muscles", "Skin", "Hair"] },
  { q: "Skeleton and ___ help the body move.", ans: "muscles", opts: ["muscles", "joints", "nails", "teeth"] },
  { q: "The ___ protects our brain.", ans: "skull", opts: ["skull", "spine", "rib cage", "joint"] },
  { q: "The ___ is in our back.", ans: "spine", opts: ["spine", "skull", "rib cage", "muscle"] },
  { q: "Bones are hard parts of the ___.", ans: "skeleton", opts: ["skeleton", "muscle", "skin", "hair"] },

  // Respiratory System
  { q: "The respiratory system helps us ___.", ans: "breathe", opts: ["breathe", "eat", "run", "sleep"] },
  { q: "Air enters our body through the ___.", ans: "nose", opts: ["nose", "ear", "eye", "mouth"] },
  { q: "The ___ connects the nose to the lungs.", ans: "windpipe", opts: ["windpipe", "spine", "bone", "joint"] },
  { q: "We have two ___ to help us breathe.", ans: "lungs", opts: ["lungs", "hearts", "stomachs", "skulls"] },
  { q: "When we breathe in, the lungs get ___.", ans: "bigger", opts: ["bigger", "smaller", "shorter", "thinner"] },
  { q: "When we breathe out, the lungs get ___.", ans: "smaller", opts: ["smaller", "bigger", "longer", "harder"] },
  { q: "Another name for the windpipe is ___.", ans: "trachea", opts: ["trachea", "lung", "nose", "muscle"] },
  { q: "The ___ system brings oxygen to our body.", ans: "respiratory", opts: ["respiratory", "urinary", "skeletal", "muscular"] },
  { q: "What goes into our lungs when we breathe?", ans: "Air", opts: ["Air", "Water", "Food", "Milk"] },
  { q: "We ___ through our nose.", ans: "breathe", opts: ["breathe", "see", "hear", "taste"] },
  { q: "When air enters the lungs, they ___.", ans: "expand", opts: ["expand", "shrink", "stop", "close"] },
  { q: "The trachea is also called the ___.", ans: "windpipe", opts: ["windpipe", "spine", "rib", "skull"] },

  // Urinary System
  { q: "The urinary system manages ___ and water.", ans: "waste", opts: ["waste", "food", "air", "blood"] },
  { q: "The ___ holds urine until it goes out.", ans: "bladder", opts: ["bladder", "kidney", "ureter", "urethra"] },
  { q: "Urine goes out of the body through the ___.", ans: "urethra", opts: ["urethra", "bladder", "kidney", "nose"] },
  { q: "The ___ make urine.", ans: "kidneys", opts: ["kidneys", "lungs", "bones", "muscles"] },
  { q: "The ___ are tubes that carry urine to the bladder.", ans: "ureters", opts: ["ureters", "urethra", "lungs", "nerves"] },
  { q: "Liquid waste in our body is called ___.", ans: "urine", opts: ["urine", "water", "milk", "juice"] },
  { q: "Kidneys extract ___ from our body.", ans: "waste", opts: ["waste", "food", "oxygen", "sugar"] },
  { q: "Spelling: K_dn_y", ans: "Kidney", opts: ["Kidney", "Kidny", "Kideny", "Kidnee"] },
  { q: "Spelling: Bl_dd_r", ans: "Bladder", opts: ["Bladder", "Blader", "Bladdar", "Bladdere"] },
  { q: "Spelling: U_eth_a", ans: "Urethra", opts: ["Urethra", "Urethra", "Urethra", "Urthra"] },
  { q: "The urinary system is for ___ management.", ans: "water", opts: ["water", "air", "food", "heat"] },
  { q: "Waste water goes ___ the body.", ans: "out of", opts: ["out of", "into", "around", "over"] },
  { q: "Each kidney connects to a ___.", ans: "ureter", opts: ["ureter", "lung", "nose", "bone"] },

  // Seasons
  { q: "How many seasons are there in a year?", ans: "4", opts: ["4", "2", "12", "7"] },
  { q: "In which season is the weather warm?", ans: "Spring", opts: ["Spring", "Winter", "Summer", "Autumn"] },
  { q: "In which season is the weather hot?", ans: "Summer", opts: ["Summer", "Winter", "Autumn", "Spring"] },
  { q: "In which season is the weather cool?", ans: "Autumn", opts: ["Autumn", "Summer", "Winter", "Spring"] },
  { q: "In which season is the weather cold?", ans: "Winter", opts: ["Winter", "Summer", "Autumn", "Spring"] },
  { q: "Flowers bloom in the ___.", ans: "spring", opts: ["spring", "winter", "autumn", "summer"] },
  { q: "Leaves fall in the ___.", ans: "autumn", opts: ["autumn", "spring", "summer", "winter"] },
  { q: "We go to the beach in the ___.", ans: "summer", opts: ["summer", "winter", "spring", "autumn"] },
  { q: "It may snow in the ___.", ans: "winter", opts: ["winter", "summer", "spring", "autumn"] },
  { q: "Seasons change every few ___.", ans: "months", opts: ["months", "days", "hours", "minutes"] },

  // Natural Disasters
  { q: "A ___ is too much water on the land.", ans: "flood", opts: ["flood", "drought", "storm", "landslide"] },
  { q: "A ___ is when there is no rain for a long time.", ans: "drought", opts: ["drought", "flood", "storm", "landslide"] },
  { q: "A ___ has strong winds and heavy rain.", ans: "storm", opts: ["storm", "drought", "flood", "landslide"] },
  { q: "A ___ is when rock and earth fall down a mountain.", ans: "landslide", opts: ["landslide", "storm", "drought", "flood"] },
  { q: "Natural disasters are ___ to humans.", ans: "dangerous", opts: ["dangerous", "safe", "happy", "funny"] },
  { q: "Disasters can ___ buildings.", ans: "damage", opts: ["damage", "build", "clean", "paint"] },
  { q: "Which one means NO rain?", ans: "drought", opts: ["drought", "flood", "storm", "snow"] },
  { q: "Which one means HUGE waves or water?", ans: "flood", opts: ["flood", "drought", "wind", "sand"] },
  { q: "Landslides happen on ___.", ans: "mountains", opts: ["mountains", "oceans", "swamps", "clouds"] },
  { q: "Storms bring strong ___.", ans: "winds", opts: ["winds", "food", "cars", "toys"] },
  { q: "Always stay ___ during a storm.", ans: "safe", opts: ["safe", "outside", "wet", "angry"] },
  { q: "Natural disasters damage ___.", ans: "houses", opts: ["houses", "clouds", "stars", "moon"] }
];

const ENGLISH_QUESTIONS: Question[] = [];

export default function App() {
  const [gameState, setGameState] = useState<'setup' | 'subject_select' | 'topic_select' | 'mode_select' | 'start' | 'playing' | 'result'>('setup');
  const [subject, setSubject] = useState<SubjectId>('math');
  const [grade, setGrade] = useState<Grade>('2');
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [gameMode, setGameMode] = useState<GameMode>('endless');
  const [playerName, setPlayerName] = useState('');
  const [selectedIconId, setSelectedIconId] = useState('cat');
  const [question, setQuestion] = useState<Question | null>(null);
  const [userAnswer, setUserAnswer] = useState('');
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(30);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [quizIndex, setQuizIndex] = useState(0);
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [englishQuestions, setEnglishQuestions] = useState<Question[]>(ENGLISH_QUESTIONS_DATA);
  const [showEnglishImport, setShowEnglishImport] = useState(false);
  const [importText, setImportText] = useState('');

  const parseEnglishMarkdown = (text: string) => {
    const questions: Question[] = [];
    const sections = text.split(/#\s*Q:/i).filter(s => s.trim());
    
    sections.forEach(section => {
      const lines = section.split('\n').map(l => l.trim()).filter(l => l);
      if (lines.length >= 2) {
        const q = lines[0];
        let ans = '';
        let opts: string[] = [];
        
        lines.slice(1).forEach(line => {
          if (line.toLowerCase().startsWith('ans:')) {
            ans = line.substring(4).trim();
          } else if (line.toLowerCase().startsWith('opts:')) {
            opts = line.substring(5).split(',').map(o => o.trim());
          }
        });
        
        if (q && ans) {
          questions.push({
            type: 'text',
            q,
            ans,
            opts: opts.length > 0 ? opts : [ans]
          });
        }
      }
    });
    
    if (questions.length > 0) {
      setEnglishQuestions(questions);
      setShowEnglishImport(false);
      alert(`Đã nhập thành công ${questions.length} câu hỏi Tiếng Anh!`);
    } else {
      alert('Không tìm thấy câu hỏi nào hợp lệ. Vui lòng kiểm tra định dạng!');
    }
  };

  const handleLogin = async (useRedirect = false) => {
    const provider = new GoogleAuthProvider();
    setLoginError(null);
    try {
      if (useRedirect) {
        await signInWithRedirect(auth, provider);
      } else {
        await signInWithPopup(auth, provider);
      }
    } catch (err: any) {
      setLoginError(err.message);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      if (u) {
        setUser(u);
        setIsAuthReady(true);
        if (u.displayName && !playerName) setPlayerName(u.displayName);
      } else {
        setIsAuthReady(false);
      }
    });
    return () => unsubscribe();
  }, [playerName]);

  const saveQuestionToFirestore = async (q: Question) => {
    if (!isAuthReady || !user) return;
    try {
      await addDoc(collection(db, 'questions'), {
        grade, subject, type: q.type, q: q.q || 'Math', ans: q.ans || q.answer, createdAt: new Date().toISOString()
      });
    } catch (e) {}
  };

  const generateQuestion = useCallback(() => {
    let newQ: Question;
    
    if (subject === 'math') {
      let mathType = 'calc';
      if (selectedTopic && selectedTopic !== 'all') {
             if (selectedTopic === 'calc_3_digit') mathType = 'calc';
        else if (selectedTopic === 'geometry') mathType = 'geometry';
        else if (selectedTopic === 'special_numbers') mathType = 'special_numbers';
        else if (selectedTopic === 'measurement') mathType = 'unit';
        else if (selectedTopic === 'word_problems') mathType = 'word';
        else if (selectedTopic === 'find_x') mathType = 'find_x';
      } else {
        const types = ['calc', 'compare', 'unit', 'word', 'special_numbers', 'find_x', 'geometry'];
        mathType = types[Math.floor(Math.random() * types.length)];
      }

      if (mathType === 'calc') {
        const n1 = Math.floor(Math.random() * 900) + 10;
        const n2 = Math.floor(Math.random() * 90) + 1;
        const op = Math.random() < 0.5 ? '+' : '-';
        const ans = op === '+' ? n1 + n2 : n1 - n2;
        newQ = { type: 'math', num1: n1, num2: n2, operator: op, answer: ans };
      } else if (mathType === 'geometry') {
        newQ = { 
          type: 'text', q: "Hình sau có bao nhiêu tam giác?", ans: 3, opts: [2, 3, 4, 5],
          text: (
            <svg viewBox="0 0 100 100" className="w-24 h-24 mx-auto mb-4">
              <path d="M50 10 L10 90 L90 90 Z" fill="none" stroke="currentColor" strokeWidth="2" />
              <line x1="50" y1="10" x2="50" y2="90" stroke="currentColor" strokeWidth="2" />
            </svg>
          )
        };
      } else if (mathType === 'special_numbers') {
        newQ = { type: 'text', q: "Số lớn nhất có 2 chữ số khác nhau là:", ans: 98, opts: [99, 98, 90, 89] };
      } else if (mathType === 'unit') {
        newQ = { type: 'text', q: "1m = ... cm?", ans: 100, opts: [10, 100, 1000, 1] };
      } else if (mathType === 'find_x') {
        const x = Math.floor(Math.random() * 50) + 10;
        const a = Math.floor(Math.random() * 20) + 1;
        newQ = { type: 'text', q: `Tìm x: x + ${a} = ${x + a}`, ans: x };
      } else {
        newQ = { type: 'text', q: "An có 5 táo, Bình cho An 3 táo. An có mấy táo?", ans: 8, opts: [7, 8, 9, 10] };
      }
    } else if (subject === 'vietnamese') {
      newQ = VIETNAMESE_DATA[Math.floor(Math.random() * VIETNAMESE_DATA.length)];
    } else {
      if (englishQuestions.length > 0) {
        newQ = englishQuestions[Math.floor(Math.random() * englishQuestions.length)];
      } else {
        newQ = { type: 'text', q: "Vui lòng nhập dữ liệu Tiếng Anh để bắt đầu!", ans: "OK", opts: ["OK"] };
      }
    }

    if (!newQ.opts) {
      const ans = newQ.ans || newQ.answer;
      if (typeof ans === 'number') {
        const opts = [ans];
        while (opts.length < 4) {
          const w = ans + Math.floor(Math.random() * 10) - 5;
          if (w >= 0 && !opts.includes(w)) opts.push(w);
        }
        newQ.opts = opts.sort(() => Math.random() - 0.5);
      }
    }

    setQuestion(newQ);
    saveQuestionToFirestore(newQ);
    setUserAnswer('');
    setTimeLeft(30);
    setFeedback(null);
  }, [subject, grade, selectedTopic, englishQuestions, user, isAuthReady]);

  const startGame = () => {
    setScore(0);
    setQuizIndex(0);
    setGameState('playing');
    generateQuestion();
  };

  const handleAnswer = (val: string | number) => {
    if (!question || feedback) return;
    const correctAns = (question.ans || question.answer)?.toString().toLowerCase().trim();
    const isCorrect = val.toString().toLowerCase().trim() === correctAns;
    
    if (isCorrect) {
      setScore(s => s + 1);
      setFeedback('correct');
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
    } else {
      setFeedback('wrong');
    }

    setTimeout(() => {
      if (gameMode === 'quiz' && quizIndex >= 19) setGameState('result');
      else {
        setQuizIndex(i => i + 1);
        generateQuestion();
      }
    }, 1500);
  };

  useEffect(() => {
    let timer: any;
    if (gameState === 'playing' && timeLeft > 0 && !feedback && gameMode === 'endless' && subject !== 'english') {
      timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    } else if (timeLeft === 0 && gameState === 'playing' && gameMode === 'endless' && subject !== 'english') {
      setGameState('result');
    }
    return () => clearInterval(timer);
  }, [gameState, timeLeft, feedback, gameMode, subject]);

  return (
    <div className="min-h-screen bg-yellow-50 font-sans text-gray-800 flex flex-col items-center justify-center p-4">
      <AnimatePresence mode="wait">
        {gameState === 'setup' && (
          <motion.div key="setup" className="text-center bg-white p-8 rounded-3xl shadow-xl border-4 border-yellow-400 max-w-md w-full">
            <h1 className="text-3xl font-black text-orange-500 mb-6">Chào bé! Tên bé là gì?</h1>
            <input type="text" value={playerName} onChange={(e) => setPlayerName(e.target.value)} placeholder="Nhập tên..." className="w-full p-4 text-xl border-4 border-blue-100 rounded-2xl mb-8 text-center" />
            <div className="flex gap-2">
              <button onClick={() => !user ? handleLogin() : setGameState('subject_select')} disabled={!playerName} className="flex-1 bg-green-500 text-white text-xl font-bold py-4 rounded-full shadow-lg">
                {!user ? "Đăng nhập Google" : "Tiếp tục"}
              </button>
              <button onClick={() => setShowEnglishImport(true)} className="p-4 bg-gray-100 rounded-full"><Globe /></button>
            </div>
            {showEnglishImport && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
                <div className="bg-white p-6 rounded-3xl w-full max-w-lg">
                  <h3 className="font-bold mb-4">Nhập Tiếng Anh (.md)</h3>
                  <textarea value={importText} onChange={(e) => setImportText(e.target.value)} className="w-full h-64 p-4 border rounded-2xl mb-4 font-mono text-sm" placeholder="# Q: Hello? \n ans: Xin chào \n opts: Xin chào, Tạm biệt" />
                  <div className="flex gap-2">
                    <button onClick={() => setShowEnglishImport(false)} className="flex-1 p-3 bg-gray-100 rounded-xl">Hủy</button>
                    <button onClick={() => parseEnglishMarkdown(importText)} className="flex-1 p-3 bg-blue-500 text-white rounded-xl">Nhập</button>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {gameState === 'subject_select' && (
          <motion.div key="subject_select" className="text-center bg-white p-8 rounded-3xl shadow-xl border-4 border-blue-400 max-w-md w-full">
            <h2 className="text-2xl font-bold mb-6">Chọn môn học</h2>
            <div className="grid gap-4">
              {SUBJECTS.map(s => (
                <button key={s.id} onClick={() => { setSubject(s.id as SubjectId); setGameState(s.id==='math'?'topic_select':'mode_select'); }} className="p-4 border-4 rounded-2xl flex items-center gap-4">
                  <div className={`${s.color} p-2 rounded-lg text-white`}><s.Icon /></div>
                  <span className="font-bold">{s.name}</span>
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {gameState === 'topic_select' && (
          <motion.div key="topic_select" className="text-center bg-white p-8 rounded-3xl border-4 border-orange-400 max-w-md w-full">
            <h2 className="text-2xl font-bold mb-6">Chọn chủ đề</h2>
            <div className="grid gap-4">
              {MATH_TOPICS_G2.map(t => (
                <button key={t.id} onClick={() => { setSelectedTopic(t.id); setGameState('mode_select'); }} className="p-3 border-2 rounded-xl text-left font-bold">{t.name}</button>
              ))}
            </div>
          </motion.div>
        )}

        {gameState === 'mode_select' && (
          <motion.div key="mode" className="bg-white p-8 rounded-3xl border-4 border-blue-400 w-full max-w-md">
            <h2 className="text-2xl font-bold mb-6 text-center">Chế độ chơi</h2>
            <button onClick={() => { setGameMode('endless'); setGameState('start'); }} className="w-full p-4 bg-orange-50 border-2 rounded-xl mb-4 font-bold">Luyện tập tự do</button>
            <button onClick={() => { setGameMode('quiz'); setGameState('start'); }} className="w-full p-4 bg-blue-50 border-2 rounded-xl font-bold">Đề trắc nghiệm (20 câu)</button>
          </motion.div>
        )}

        {gameState === 'start' && (
          <motion.div key="st" className="text-center bg-white p-8 rounded-3xl border-4 border-green-400 w-full max-w-md">
            <h2 className="text-3xl font-black mb-6">Sẵn sàng chưa {playerName}?</h2>
            <button onClick={startGame} className="w-full bg-green-500 text-white text-2xl font-bold py-4 rounded-full">Bắt đầu!</button>
          </motion.div>
        )}

        {gameState === 'playing' && question && (
          <motion.div key="play" className="w-full max-w-2xl">
            <div className="bg-white p-4 rounded-2xl shadow mb-4 flex justify-between items-center font-bold">
              <div className="flex flex-col">
                <span>{playerName} | {subject.toUpperCase()}</span>
                {gameMode === 'quiz' && <span className="text-xs text-blue-400">Câu {quizIndex + 1} / 20</span>}
              </div>
              <div className="flex items-center gap-4">
                <span className="text-orange-500">Điểm: {score}</span>
                {gameMode === 'endless' && subject !== 'english' && <span className="text-blue-500">{timeLeft}s</span>}
              </div>
            </div>
            <div className="bg-white p-10 rounded-3xl shadow-xl border-b-8 border-blue-200 text-center relative overflow-hidden">
               <AnimatePresence>
                {feedback === 'correct' && <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute inset-0 flex items-center justify-center bg-green-50 z-10"><CheckCircle2 size={100} className="text-green-500"/></motion.div>}
                {feedback === 'wrong' && <motion.div initial={{ x: -10 }} animate={{ x: 10 }} transition={{ repeat: 5, duration: 0.1 }} className="absolute inset-0 flex items-center justify-center bg-red-50 z-10"><XCircle size={100} className="text-red-500"/></motion.div>}
              </AnimatePresence>
              <div className="text-2xl text-blue-500 mb-4">{question.q}</div>
              {question.type === 'math' ? (
                <div className="text-6xl font-black mb-8">{question.num1} {question.operator === 'x' ? '×' : (question.operator === ':' ? '÷' : question.operator)} {question.num2} = ?</div>
              ) : (
                <div className="text-4xl font-black mb-8">{question.text}</div>
              )}
              <div className="grid grid-cols-2 gap-4">
                {question.opts?.map((o, i) => (
                  <button key={i} onClick={() => handleAnswer(o)} className="p-4 bg-blue-50 border-2 border-blue-100 rounded-xl text-xl font-bold hover:bg-blue-100">{o}</button>
                ))}
              </div>
              {!question.opts && (
                <form onSubmit={(e) => { e.preventDefault(); handleAnswer(userAnswer); }}>
                  <input ref={inputRef} type="text" value={userAnswer} onChange={e => setUserAnswer(e.target.value)} className="w-32 p-4 text-3xl border-4 rounded-xl text-center" autoFocus />
                  <button type="submit" className="block w-full mt-4 bg-blue-500 text-white p-3 rounded-xl font-bold">Kiểm tra</button>
                </form>
              )}
            </div>
          </motion.div>
        )}

        {gameState === 'result' && (
          <motion.div key="res" className="text-center bg-white p-10 rounded-3xl border-4 border-orange-400 w-full max-w-md">
            <Trophy size={80} className="text-yellow-500 mx-auto mb-4" />
            <h2 className="text-4xl font-black mb-4">KẾT QUẢ</h2>
            <p className="text-xl mb-8">Bé đạt được <span className="text-orange-500 font-bold">{score}</span> {gameMode === 'quiz' ? '/ 20' : ''} điểm!</p>
            <button onClick={() => setGameState('setup')} className="w-full bg-blue-500 text-white p-4 rounded-full font-bold">Chơi lại từ đầu</button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
