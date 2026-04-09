/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef, FormEvent } from 'react';
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
import { collection, addDoc, serverTimestamp, query, where, getDocs, limit, getDocFromServer, doc } from 'firebase/firestore';

type Operator = '+' | '-' | 'x' | ':' | '>' | '<' | '=';
type GameMode = 'endless' | 'quiz';
type SubjectId = 'math' | 'vietnamese' | 'english';
type Grade = '2' | '6';

type Question = {
  type: 'math' | 'text';
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
  { q: "Từ đồng nghĩa với 'Học tập' là gì?", text: "", ans: "Học hành", opts: ["Học hành", "Vui chơi"] },
  { q: "Con gì kêu 'Quác quác'?", text: "", ans: "Con vịt", opts: ["Con gà", "Con vịt", "Con mèo"] },
  { q: "Điền vào chỗ trống: 'c' hay 'k'?", text: "con ...im", ans: "k", opts: ["c", "k"] },
  { q: "Điền vào chỗ trống: 'ch' hay 'tr'?", text: "...ung thu", ans: "tr", opts: ["ch", "tr"] },
  { q: "Điền vào chỗ trống: 'd', 'r' hay 'gi'?", text: "...a đình", ans: "gi", opts: ["d", "r", "gi"] },
  { q: "Điền vào chỗ trống: 's' hay 'x'?", text: "...inh đẹp", ans: "x", opts: ["s", "x"] },
  { q: "Dấu câu nào dùng để kết thúc câu kể?", text: "", ans: "Dấu chấm", opts: ["Dấu chấm", "Dấu hỏi", "Dấu phẩy"] },
  { q: "Dấu câu nào dùng để kết thúc câu hỏi?", text: "", ans: "Dấu hỏi", opts: ["Dấu chấm", "Dấu hỏi", "Dấu chấm than"] },
  { q: "Từ nào chỉ hoạt động của học sinh?", text: "", ans: "Đọc bài", opts: ["Cái bàn", "Đọc bài", "Xanh lơ"] },
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
  { q: "Từ nào đồng nghĩa với 'Đẹp'?", text: "", ans: "Xinh", opts: ["Xinh", "Xấu", "Bẩn"] },
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
  { q: "Trong câu 'Em đang học bài', từ nào là động từ?", text: "", ans: "học bài", opts: ["Em", "đang", "học bài"] },
  { q: "Trong câu 'Bông hoa rất đẹp', từ nào là tính từ?", text: "", ans: "đẹp", opts: ["Bông hoa", "rất", "đẹp"] },
  { q: "Câu 'Bố em là bác sĩ' thuộc kiểu câu nào?", text: "", ans: "Ai là gì?", opts: ["Ai là gì?", "Ai làm gì?", "Ai thế nào?"] },
  { q: "Câu 'Chú chim đang hót líu lo' thuộc kiểu câu nào?", text: "", ans: "Ai làm gì?", opts: ["Ai là gì?", "Ai làm gì?", "Ai thế nào?"] },
  { q: "Câu 'Bầu trời hôm nay rất xanh' thuộc kiểu câu nào?", text: "Ai thế nào?", ans: "Ai thế nào?", opts: ["Ai là gì?", "Ai làm gì?", "Ai thế nào?"] },
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

const ENGLISH_DATA = [
  { q: "Màu 'Red' là màu gì?", text: "", ans: "Màu đỏ", opts: ["Màu đỏ", "Màu xanh", "Màu vàng"] },
  { q: "'Con mèo' tiếng Anh là gì?", text: "", ans: "Cat", opts: ["Dog", "Cat", "Rabbit"] },
  { q: "Số 'Five' là số mấy?", text: "", ans: "5", opts: ["3", "4", "5"] },
  { q: "'Apple' là quả gì?", text: "", ans: "Quả táo", opts: ["Quả táo", "Quả cam", "Quả chuối"] },
  { q: "Màu 'Blue' là màu gì?", text: "", ans: "Màu xanh dương", opts: ["Màu xanh lá", "Màu xanh dương", "Màu tím"] },
  { q: "'Hello' nghĩa là gì?", text: "", ans: "Xin chào", opts: ["Xin chào", "Tạm biệt", "Cảm ơn"] },
  { q: "'Elephant' là con gì?", text: "", ans: "Con voi", opts: ["Con voi", "Con hổ", "Con hươu"] },
  { q: "Màu 'Green' là màu gì?", text: "", ans: "Màu xanh lá", opts: ["Màu đỏ", "Màu xanh lá", "Màu đen"] },
  { q: "'Con chó' tiếng Anh là gì?", text: "", ans: "Dog", opts: ["Dog", "Cat", "Bird"] },
  { q: "Số 'Ten' là số mấy?", text: "", ans: "10", opts: ["1", "10", "100"] },
  { q: "'Banana' là quả gì?", text: "", ans: "Quả chuối", opts: ["Quả táo", "Quả chuối", "Quả nho"] },
  { q: "'Thank you' nghĩa là gì?", text: "", ans: "Cảm ơn", opts: ["Xin lỗi", "Cảm ơn", "Tạm biệt"] },
  { q: "'Father' nghĩa là gì?", text: "", ans: "Bố", opts: ["Mẹ", "Bố", "Anh trai"] },
  { q: "'Mother' nghĩa là gì?", text: "", ans: "Mẹ", opts: ["Mẹ", "Bố", "Chị gái"] },
  { q: "'Lion' là con gì?", text: "", ans: "Con sư tử", opts: ["Con sư tử", "Con hổ", "Con báo"] },
  { q: "'Sun' nghĩa là gì?", text: "", ans: "Mặt trời", opts: ["Mặt trăng", "Mặt trời", "Ngôi sao"] },
  { q: "'Water' nghĩa là gì?", text: "", ans: "Nước", opts: ["Nước", "Sữa", "Bánh"] },
  { q: "'Book' nghĩa là gì?", text: "", ans: "Quyển sách", opts: ["Cái bút", "Quyển sách", "Cái thước"] },
  { q: "'Pencil' nghĩa là gì?", text: "", ans: "Bút chì", opts: ["Bút chì", "Bút mực", "Cục tẩy"] },
  { q: "Màu 'Yellow' là màu gì?", text: "", ans: "Màu vàng", opts: ["Màu trắng", "Màu đen", "Màu vàng"] },
  { q: "Số 'Seven' là số mấy?", text: "", ans: "7", opts: ["6", "7", "8"] },
  { q: "'Bird' là con gì?", text: "", ans: "Con chim", opts: ["Con cá", "Con chim", "Con thỏ"] },
  { q: "'Orange' là quả gì?", text: "", ans: "Quả cam", opts: ["Quả cam", "Quả táo", "Quả lê"] },
  { q: "'Milk' nghĩa là gì?", text: "", ans: "Sữa", opts: ["Sữa", "Nước", "Trà"] },
  { q: "'Brother' nghĩa là gì?", text: "", ans: "Anh/Em trai", opts: ["Anh/Em trai", "Chị/Em gái", "Bố"] },
  { q: "'Sister' nghĩa là gì?", text: "", ans: "Chị/Em gái", opts: ["Anh/Em trai", "Chị/Em gái", "Mẹ"] },
  { q: "'Head' là bộ phận nào?", text: "", ans: "Cái đầu", opts: ["Cái đầu", "Cái tay", "Cái chân"] },
  { q: "'Hand' là bộ phận nào?", text: "", ans: "Bàn tay", opts: ["Bàn tay", "Bàn chân", "Cái tai"] },
  { q: "'Butterfly' là con gì?", text: "", ans: "Con bướm", opts: ["Con bướm", "Con ong", "Con sâu"] },
  { q: "Số 'Twelve' là số mấy?", text: "", ans: "12", opts: ["11", "12", "20"] },
  { q: "Màu 'Pink' là màu gì?", text: "", ans: "Màu hồng", opts: ["Màu hồng", "Màu đỏ", "Màu tím"] },
  { q: "'Chair' nghĩa là gì?", text: "", ans: "Cái ghế", opts: ["Cái bàn", "Cái ghế", "Cái tủ"] },
  { q: "'Table' nghĩa là gì?", text: "", ans: "Cái bàn", opts: ["Cái bàn", "Cái ghế", "Cái cửa"] },
  { q: "'Black' là màu gì?", text: "", ans: "Màu đen", opts: ["Màu đen", "Màu trắng", "Màu xám"] },
  { q: "'White' là màu gì?", text: "", ans: "Màu trắng", opts: ["Màu đen", "Màu trắng", "Màu nâu"] },
  { q: "'Duck' là con gì?", text: "", ans: "Con vịt", opts: ["Con vịt", "Con gà", "Con ngỗng"] },
  { q: "'Fish' là con gì?", text: "", ans: "Con cá", opts: ["Con cá", "Con cua", "Con tôm"] },
  { q: "'Rice' nghĩa là gì?", text: "", ans: "Cơm/Gạo", opts: ["Cơm/Gạo", "Bánh mì", "Phở"] },
];

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

  // Firebase Error Handling
  enum OperationType {
    CREATE = 'create',
    UPDATE = 'update',
    DELETE = 'delete',
    LIST = 'list',
    GET = 'get',
    WRITE = 'write',
  }

  interface FirestoreErrorInfo {
    error: string;
    operationType: OperationType;
    path: string | null;
    authInfo: {
      userId: string | undefined;
      email: string | null | undefined;
      emailVerified: boolean | undefined;
      isAnonymous: boolean | undefined;
    }
  }

  const handleFirestoreError = (error: unknown, operationType: OperationType, path: string | null) => {
    const errInfo: FirestoreErrorInfo = {
      error: error instanceof Error ? error.message : String(error),
      authInfo: {
        userId: auth.currentUser?.uid,
        email: auth.currentUser?.email,
        emailVerified: auth.currentUser?.emailVerified,
        isAnonymous: auth.currentUser?.isAnonymous,
      },
      operationType,
      path
    };
    console.error('Firestore Error: ', JSON.stringify(errInfo));
    // We don't throw here to avoid crashing the UI, but we log it for debugging
  };

  const handleLogin = async (useRedirect = false) => {
    const provider = new GoogleAuthProvider();
    setLoginError(null);
    console.log(`Starting login process (${useRedirect ? 'Redirect' : 'Popup'})...`);
    
    try {
      provider.setCustomParameters({ prompt: 'select_account' });
      
      if (useRedirect) {
        await signInWithRedirect(auth, provider);
      } else {
        const result = await signInWithPopup(auth, provider);
        console.log("Login successful:", result.user.email);
      }
    } catch (err: any) {
      console.error("Login error details:", err);
      const errorCode = err.code;
      const errorMessage = err.message;
      const currentHost = window.location.hostname;

      if (errorCode === 'auth/unauthorized-domain') {
        setLoginError(`LỖI: Tên miền '${currentHost}' chưa được cấp phép. 
          Cách sửa: 
          1. Vào Firebase Console > Authentication > Settings.
          2. Tìm mục 'Authorized domains'.
          3. Nhấn 'Add domain' và dán '${currentHost}' vào.`);
      } else if (errorCode === 'auth/popup-closed-by-user') {
        setLoginError("Cửa sổ đăng nhập đã bị đóng. Bạn có thể thử lại hoặc dùng nút 'Đăng nhập bằng Chuyển hướng' bên dưới.");
      } else if (errorCode === 'auth/popup-blocked') {
        setLoginError("Trình duyệt đã chặn Popup. Hãy cho phép Popup hoặc dùng 'Đăng nhập bằng Chuyển hướng'.");
      } else {
        setLoginError(`Lỗi (${errorCode}): ${errorMessage}`);
      }
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      if (u) {
        setUser(u);
        setIsAuthReady(true);
        if (u.displayName && !playerName) {
          setPlayerName(u.displayName);
        }
      } else {
        setIsAuthReady(false);
      }
    });
    return () => unsubscribe();
  }, [playerName]);

  // Test Firestore connection
  useEffect(() => {
    if (isAuthReady) {
      const testConnection = async () => {
        try {
          await getDocFromServer(doc(db, 'test', 'connection'));
        } catch (error) {
          if (error instanceof Error && error.message.includes('the client is offline')) {
            console.error("Please check your Firebase configuration.");
          }
        }
      };
      testConnection();
    }
  }, [isAuthReady]);

  const saveQuestionToFirestore = async (q: Question) => {
    if (!isAuthReady || !user) return;
    try {
      const qData = {
        grade,
        subject,
        type: q.type,
        q: q.q || `${q.num1} ${q.operator} ${q.num2} = ?`,
        ans: q.ans?.toString() || q.answer?.toString() || '',
        opts: q.opts?.map(o => o.toString()) || [],
        createdAt: new Date().toISOString()
      };
      await addDoc(collection(db, 'questions'), qData);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'questions');
    }
  };

  const saveScoreToFirestore = async (finalScore: number) => {
    if (!isAuthReady || !user) return;
    try {
      await addDoc(collection(db, 'scores'), {
        userId: user.uid,
        playerName,
        grade,
        subject,
        score: finalScore,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'scores');
    }
  };

  const SelectedAnimal = ANIMAL_ICONS.find(a => a.id === selectedIconId) || ANIMAL_ICONS[0];

  const generateQuestion = useCallback(() => {
    let newQ: Question;
    
    if (subject === 'math') {
      if (grade === '2') {
        let mathType: string;
        
        if (selectedTopic && selectedTopic !== 'all') {
          if (selectedTopic === 'calc_3_digit') mathType = 'calc';
          else if (selectedTopic === 'geometry') mathType = 'geometry';
          else if (selectedTopic === 'special_numbers') mathType = 'special_numbers';
          else if (selectedTopic === 'measurement') {
            const mTypes = ['unit_choice', 'unit', 'compare'];
            mathType = mTypes[Math.floor(Math.random() * mTypes.length)];
          }
          else if (selectedTopic === 'word_problems') mathType = 'word';
          else if (selectedTopic === 'find_x') mathType = 'find_x';
          else mathType = 'calc';
        } else {
          const mathTypes = ['calc', 'compare', 'unit', 'word', 'estimate', 'digits', 'unit_choice', 'multi_step', 'logic', 'ordering', 'special_numbers', 'find_x', 'geometry'];
          mathType = mathTypes[Math.floor(Math.random() * mathTypes.length)];
        }
        
        if (mathType === 'calc') {
          const ops: Operator[] = ['+', '-', 'x', ':'];
          let operator = ops[Math.floor(Math.random() * ops.length)];
          let n1: number = 0, n2: number = 0, ans: number = 0;

          // Specific requested calculations or similar
          const useRequested = Math.random() < 0.3;
          if (useRequested) {
            const reqs = [
              { n1: 75, n2: 17, op: '+' as Operator },
              { n1: 8, n2: 65, op: '+' as Operator },
              { n1: 91, n2: 52, op: '-' as Operator },
              { n1: 83, n2: 36, op: '-' as Operator },
              { n1: 423, n2: 268, op: '+' as Operator },
              { n1: 365, n2: 284, op: '+' as Operator },
              { n1: 879, n2: 264, op: '-' as Operator },
              { n1: 787, n2: 467, op: '-' as Operator },
              { n1: 512, n2: 147, op: '+' as Operator },
              { n1: 100, n2: 45, op: '-' as Operator },
              { n1: 27, n2: 54, op: '+' as Operator },
              { n1: 267, n2: 125, op: '+' as Operator },
              { n1: 247, n2: 136, op: '+' as Operator },
              { n1: 802, n2: 59, op: '+' as Operator },
              { n1: 183, n2: 9, op: '+' as Operator },
              { n1: 345, n2: 156, op: '+' as Operator },
              { n1: 703, n2: 88, op: '+' as Operator }
            ];
            const r = reqs[Math.floor(Math.random() * reqs.length)];
            n1 = r.n1; n2 = r.n2; operator = r.op;
            ans = operator === '+' ? n1 + n2 : n1 - n2;
          } else if (operator === '+' || operator === '-') {
            const is3Digit = Math.random() < 0.7; // Increased 3-digit frequency
            const max = is3Digit ? 999 : 100;
            if (operator === '+') {
              n1 = Math.floor(Math.random() * (max - 100)) + 10;
              n2 = Math.floor(Math.random() * (max - n1)) + 10;
              ans = n1 + n2;
            } else {
              n1 = Math.floor(Math.random() * (max - 100)) + 100;
              n2 = Math.floor(Math.random() * (n1 - 10)) + 1;
              ans = n1 - n2;
            }
          } else {
            const table = [2, 3, 4, 5, 6, 7, 8, 9][Math.floor(Math.random() * 8)];
            const multiplier = Math.floor(Math.random() * 10) + 1;
            if (operator === 'x') {
              n1 = table; n2 = multiplier; ans = n1 * n2;
            } else {
              ans = multiplier; n1 = table * multiplier; n2 = table;
            }
          }
          newQ = { type: 'math', num1: n1, num2: n2, operator, answer: ans, q: "Đặt tính rồi tính:" };
        } else if (mathType === 'multi_step') {
          const type = Math.floor(Math.random() * 5);
          let q = "", ans = 0;
          if (type === 0) { // a * b + c
            const a = [2,3,4,5][Math.floor(Math.random()*4)];
            const b = Math.floor(Math.random()*9)+1;
            const c = Math.floor(Math.random()*50)+10;
            ans = a * b + c;
            q = `${a} x ${b} + ${c} = ?`;
          } else if (type === 1) { // a km * b / c
            const a = [2,3,4,5][Math.floor(Math.random()*4)];
            const b = [5, 10][Math.floor(Math.random()*2)];
            const c = 5;
            ans = (a * b) / c;
            q = `${a}km x ${b} : ${c} = ? km`;
          } else if (type === 2) { // a dm / b + c dm
            const a = [12, 14, 16, 18, 20][Math.floor(Math.random()*5)];
            const b = 2;
            const c = Math.floor(Math.random()*50)+10;
            ans = (a / b) + c;
            q = `${a}dm : ${b} + ${c}dm = ? dm`;
          } else if (type === 3) { // a x b : c
            const a = [2, 3, 4, 5][Math.floor(Math.random()*4)];
            const b = [4, 6, 8, 10][Math.floor(Math.random()*4)];
            const c = 2;
            ans = (a * b) / c;
            q = `${a} x ${b} : ${c} = ?`;
          } else if (type === 4) {
            ans = 30 + 70 + 831;
            q = "30 + 70 + 831 = ?";
          } else if (type === 5) {
            ans = 4 * 5 + 165;
            q = "4 x 5 + 165 = ?";
          } else if (type === 6) {
            const a = [10, 20, 30, 40, 50][Math.floor(Math.random()*5)];
            const b = 100 - a;
            const c = Math.floor(Math.random()*800)+100;
            ans = a + b + c;
            q = `${a} + ${b} + ${c} = ?`;
          } else {
            const a = [2, 3, 4, 5][Math.floor(Math.random()*4)];
            const b = [4, 5, 6][Math.floor(Math.random()*3)];
            const c = Math.floor(Math.random()*200)+100;
            ans = a * b + c;
            q = `${a} x ${b} + ${c} = ?`;
          }
          newQ = { type: 'text', q, ans };
        } else if (mathType === 'logic') {
          const type = Math.floor(Math.random() * 3);
          if (type === 0) {
            // Largest/Smallest number from digits
            const digits = [1, 4, 6, 2, 5, 8, 3, 7].sort(() => Math.random() - 0.5).slice(0, 3);
            const sorted = [...digits].sort((a, b) => b - a);
            const isEven = Math.random() < 0.5;
            const ans = sorted.join('');
            newQ = {
              type: 'text',
              q: `Từ 3 chữ số {${digits.join(', ')}}, viết số lớn nhất có 3 chữ số khác nhau?`,
              ans: ans,
              opts: [ans, sorted.reverse().join(''), sorted[0].toString() + sorted[2] + sorted[1], "999"]
            };
          } else if (type === 1) {
            // Forming numbers with condition
            const digits = [2, 4, 5, 8];
            const limit = 425;
            // Manual calculation for this specific set: 245, 248, 254, 258, 284, 285, 425 (no, <425), 428 (no)
            // Numbers starting with 2: 245, 248, 254, 258, 284, 285 (6 numbers)
            // Numbers starting with 4: 425 (no), 428 (no), 452 (no), 458 (no), 482 (no), 485 (no)
            // Total: 6
            newQ = {
              type: 'text',
              q: `Cho các số {2, 4, 5, 8}. Lập được bao nhiêu số có 3 chữ số khác nhau bé hơn 425?`,
              ans: 6,
              opts: [4, 6, 8, 12]
            };
          } else {
            const digits = [1, 6, 4];
            // Largest even number
            // 641 (no), 614 (yes), 461 (no), 416 (yes), 164 (yes), 146 (yes)
            // Largest is 614
            newQ = {
              type: 'text',
              q: `Từ 3 chữ số {1, 6, 4}, viết số chẵn lớn nhất có 3 chữ số khác nhau?`,
              ans: 614,
              opts: [641, 614, 461, 416]
            };
          }
        } else if (mathType === 'ordering') {
          const nums = Array.from({length: 4}, () => Math.floor(Math.random() * 900) + 100);
          const isDesc = Math.random() < 0.5;
          const sorted = [...nums].sort((a, b) => isDesc ? b - a : a - b);
          newQ = {
            type: 'text',
            q: `Sắp xếp các số {${nums.join(', ')}} theo thứ tự từ ${isDesc ? 'lớn đến bé' : 'bé đến lớn'}:`,
            ans: sorted.join(', '),
            opts: [
              sorted.join(', '),
              [...sorted].reverse().join(', '),
              nums.sort().join(', '),
              nums.join(', ')
            ]
          };
        } else if (mathType === 'digits') {
          // Logic: How many 3-digit numbers can be formed
          const digits = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].sort(() => Math.random() - 0.5).slice(0, 4);
          const hasZero = digits.includes(0);
          const n = digits.length;
          // Calculation for 3 distinct digits:
          // If no zero: n * (n-1) * (n-2)
          // If has zero: (n-1) * (n-1) * (n-2) (first digit can't be zero)
          const ans = hasZero ? (n - 1) * (n - 1) * (n - 2) : n * (n - 1) * (n - 2);
          
          newQ = {
            type: 'text',
            q: `Từ các chữ số {${digits.join(', ')}}, lập được bao nhiêu số có 3 chữ số khác nhau?`,
            ans: ans,
            opts: [ans, ans + 2, ans - 4, ans + 6].filter(v => v > 0)
          };
        } else if (mathType === 'unit_choice') {
          const scenarios = [
            { q: "Độ dài bút chì là 12 ...", ans: "cm", opts: ['cm', 'm', 'dm', 'km'] },
            { q: "Độ dài cái bàn là 8 ...", ans: "dm", opts: ['cm', 'm', 'dm', 'km'] },
            { q: "Chiều cao bạn Nam là 115 ...", ans: "cm", opts: ['cm', 'm', 'dm', 'km'] },
            { q: "Quãng đường từ nhà An đến trường là 3 ...", ans: "km", opts: ['cm', 'm', 'dm', 'km'] },
            { q: "Bàn học cao 50 ...", ans: "cm", opts: ['cm', 'm', 'dm', 'km'] },
            { q: "Quãng đường từ Hà Nội đến Hải Phòng là 120 ...", ans: "km", opts: ['cm', 'm', 'dm', 'km'] },
            { q: "Một bước chân của em dài khoảng 4 ...", ans: "dm", opts: ['cm', 'm', 'dm', 'km'] },
            { q: "Cửa lớp học cao 2 ...", ans: "m", opts: ['cm', 'm', 'dm', 'km'] },
            { q: "Bạn Ngọc cao 130 ...", ans: "cm", opts: ['cm', 'm', 'dm', 'km'] },
            { q: "Chiều rộng cổng trường khoảng 5 ...", ans: "m", opts: ['cm', 'm', 'dm', 'km'] },
            { q: "Quyển vở dài khoảng 2 ...", ans: "dm", opts: ['cm', 'm', 'dm', 'km'] },
            { q: "Cái bút chì dài khoảng 15 ...", ans: "cm", opts: ['cm', 'm', 'dm', 'km'] },
            { q: "Con kiến dài khoảng 5 ...", ans: "mm", opts: ['cm', 'mm', 'dm', 'm'] },
            { q: "Con gà nặng khoảng 2 ...", ans: "kg", opts: ['kg', 'g', 'l', 'km'] },
            { q: "Bao gạo nặng 50 ...", ans: "kg", opts: ['kg', 'g', 'l', 'm'] },
            { q: "Một ngày có 24 ...", ans: "giờ", opts: ['giờ', 'phút', 'giây', 'ngày'] },
            { q: "Một giờ có 60 ...", ans: "phút", opts: ['giờ', 'phút', 'giây', 'ngày'] },
            { q: "Mỗi tiết học kéo dài 35 ...", ans: "phút", opts: ['giờ', 'phút', 'giây', 'ngày'] },
            { q: "Một tuần có 7 ...", ans: "ngày", opts: ['giờ', 'phút', 'ngày', 'tháng'] }
          ];
          const sc = scenarios[Math.floor(Math.random() * scenarios.length)];
          newQ = {
            type: 'text',
            q: sc.q,
            ans: sc.ans,
            opts: sc.opts
          };
        } else if (mathType === 'compare') {
          const type = Math.floor(Math.random() * 3);
          if (type === 0) {
            // Standard number comparison
            const is3Digit = Math.random() < 0.4;
            const max = is3Digit ? 999 : 100;
            const v1 = Math.floor(Math.random() * max);
            const v2 = Math.floor(Math.random() * max);
            const ans = v1 > v2 ? '>' : (v1 < v2 ? '<' : '=');
            newQ = { type: 'math', num1: v1, num2: v2, operator: '?', answer: ans, opts: ['>', '<', '='] };
          } else if (type === 1) {
            // Measurement comparison (Length)
            const scenarios = [
              { v1: "1 m", v2: "90 cm", ans: ">" },
              { v1: "10 dm", v2: "1 m", ans: "=" },
              { v1: "20 cm", v2: "3 dm", ans: "<" },
              { v1: "5 km", v2: "500 m", ans: ">" },
              { v1: "100 cm", v2: "10 dm", ans: "=" }
            ];
            const sc = scenarios[Math.floor(Math.random() * scenarios.length)];
            newQ = { type: 'text', q: `So sánh: ${sc.v1} ... ${sc.v2}`, ans: sc.ans, opts: ['>', '<', '='] };
          } else {
            // Measurement comparison (Time/Mass)
            const scenarios = [
              { v1: "1 giờ", v2: "50 phút", ans: ">" },
              { v1: "60 phút", v2: "1 giờ", ans: "=" },
              { v1: "1 ngày", v2: "20 giờ", ans: ">" },
              { v1: "1 tuần", v2: "10 ngày", ans: "<" },
              { v1: "2 kg", v2: "2000 g", ans: "=" }
            ];
            const sc = scenarios[Math.floor(Math.random() * scenarios.length)];
            newQ = { type: 'text', q: `So sánh: ${sc.v1} ... ${sc.v2}`, ans: sc.ans, opts: ['>', '<', '='] };
          }
        } else if (mathType === 'unit') {
          const units = [
            { from: 'km', to: 'm', factor: 1000 },
            { from: 'm', to: 'cm', factor: 100 },
            { from: 'm', to: 'dm', factor: 10 },
            { from: 'dm', to: 'cm', factor: 10 },
            { from: 'giờ', to: 'phút', factor: 60 },
            { from: 'ngày', to: 'giờ', factor: 24 },
            { from: 'tuần', to: 'ngày', factor: 7 },
            { from: 'kg', to: 'g', factor: 1000 }
          ];
          const unit = units[Math.floor(Math.random() * units.length)];
          const val = unit.from === 'kg' || unit.from === 'km' ? Math.floor(Math.random() * 5) + 1 : Math.floor(Math.random() * 9) + 1;
          const correctAns = val * unit.factor;
          
          const opts = [correctAns];
          const possibleMistakes = [val * 10, val * 100, val * 1000, val * 60, val * 24].filter(v => v !== correctAns && v > 0);
          while (opts.length < 4 && possibleMistakes.length > 0) {
            const m = possibleMistakes.shift();
            if (m && !opts.includes(m)) opts.push(m);
          }
          while (opts.length < 4) {
            const wrong = correctAns + (Math.random() < 0.5 ? 10 : -5);
            if (wrong > 0 && !opts.includes(wrong)) opts.push(wrong);
          }

          newQ = { 
            type: 'text', 
            q: `Đổi đơn vị: ${val} ${unit.from} = ... ${unit.to}?`, 
            ans: correctAns,
            opts: opts.sort(() => Math.random() - 0.5)
          };
        } else if (mathType === 'word') {
          const scenarios = [
            { template: "An có {n1}kg gạo, Bình có {n2}kg gạo. Cả hai có bao nhiêu kg?", op: '+' },
            { template: "Mẹ mua {n1}l dầu, dùng hết {n2}l. Còn lại bao nhiêu lít?", op: '-' },
            { template: "Mỗi túi có {n1} quả cam. 5 túi có bao nhiêu quả?", op: 'x', n2: 5 },
            { template: "Một nhà máy sáng nay sản xuất được {n1} chiếc bánh mì tròn và {n2} chiếc bánh mì dẹt. Hỏi sáng nay nhà máy sản xuất được tất cả bao nhiêu chiếc bánh mì?", op: '+' },
            { template: "Một cửa hàng bán đồ thể thao đã nhập về {n1} quả bóng đá, số quả bóng rổ cửa hàng nhập về nhiều hơn số quả bóng đá {n2} quả. Hỏi cửa hàng đã nhập về bao nhiêu quả bóng rổ?", op: '+' },
            { template: "Khối 2 có 1 đội nam và 1 đội nữ tham gia thi nhảy dây, mỗi đội có {n1} bạn. Hỏi tất cả có bao nhiêu bạn?", op: 'x', n2: 2 },
            { template: "An mua {n1} bông hoa và cắm mỗi lọ {n2} bông. Hỏi An đã cắm được bao nhiêu lọ hoa?", op: ':' },
            { template: "Có {n1} cái kẹo chia đều cho {n2} bạn. Mỗi bạn được mấy cái?", op: ':' },
            { template: "Mỗi con thỏ có 2 cái tai. {n1} con thỏ có bao nhiêu cái tai?", op: 'x', n2: 2 },
            { template: "Mỗi bàn có 4 chân. {n1} cái bàn có bao nhiêu chân?", op: 'x', n2: 4 },
            { template: "Có {n1} học sinh xếp thành các hàng, mỗi hàng {n2} bạn. Hỏi có bao nhiêu hàng?", op: ':' },
            { template: "Một sợi dây dài {n1}cm, cắt đi {n2}cm. Còn lại bao nhiêu cm?", op: '-' },
            { template: "Lớp 2A có {n1} bạn, lớp 2B có {n2} bạn. Cả hai lớp có bao nhiêu bạn?", op: '+' },
            { template: "Trong vườn có {n1} cây cam và {n2} cây chanh. Hỏi có tất cả bao nhiêu cây?", op: '+' },
            { template: "Một cửa hàng có {n1} quả trứng, đã bán {n2} quả. Còn lại bao nhiêu quả?", op: '-' },
            { template: "Mỗi lọ hoa cắm được {n1} bông hoa. 3 lọ như thế cắm được bao nhiêu bông?", op: 'x', n2: 3 },
            { template: "Vườn cam có {n1} cây. Vườn táo nhiều hơn vườn cam {n2} cây. Hỏi vườn táo có bao nhiêu cây?", op: '+' },
            { template: "Đàn vịt có {n1} con, đàn gà ít hơn {n2} con. Hỏi đàn gà có bao nhiêu con?", op: '-' },
            { template: "Cửa hàng có {n1} bao gạo, đã bán {n2} bao. Còn lại bao nhiêu bao?", op: '-' },
            { template: "Một trường học có {n1} học sinh nam và {n2} học sinh nữ. Hỏi trường có tất cả bao nhiêu học sinh?", op: '+' },
            { template: "Mẹ hái được {n1} quả táo, chị hái được ít hơn mẹ {n2} quả. Hỏi chị hái được bao nhiêu quả?", op: '-' },
            { template: "Có {n1} cái bánh chia đều vào {n2} đĩa. Mỗi đĩa có mấy cái bánh?", op: ':' },
            { template: "Có {n1} quyển vở chia đều cho {n2} nhóm. Mỗi nhóm được bao nhiêu quyển?", op: ':' },
            { template: "Vườn nhà bạn Thỏ có {n1} cây cà rốt, vườn nhà bạn Sóc có nhiều hơn {n2} cây cà rốt. Hỏi vườn nhà cả 2 bạn có tất cả bao nhiêu cây cà rốt?", op: 'two_step_add' },
            { template: "Nhà An có {n1} con gà, nhà Bình có nhiều hơn {n2} con gà. Hỏi cả hai nhà có tất cả bao nhiêu con gà?", op: 'two_step_add' }
          ];
          const sc = scenarios[Math.floor(Math.random() * scenarios.length)];
          let n1 = 0, n2 = 0, ans = 0;
          
          if (sc.op === '+') {
            n1 = Math.floor(Math.random() * 50) + 10;
            n2 = Math.floor(Math.random() * 40) + 5;
            ans = n1 + n2;
          } else if (sc.op === '-') {
            n1 = Math.floor(Math.random() * 90) + 10;
            n2 = Math.floor(Math.random() * (n1 - 5)) + 1;
            ans = n1 - n2;
          } else if (sc.op === 'x') {
            n1 = (sc as any).n1 || Math.floor(Math.random() * 8) + 2;
            n2 = (sc as any).n2 || Math.floor(Math.random() * 5) + 2;
            ans = n1 * n2;
          } else if (sc.op === 'two_step_add') {
            n1 = Math.floor(Math.random() * 200) + 100;
            n2 = Math.floor(Math.random() * 20) + 5;
            // For the carrot problem specifically if it's the one
            if (sc.template.includes("cà rốt")) { n1 = 255; n2 = 8; }
            ans = n1 + (n1 + n2);
          } else {
            ans = Math.floor(Math.random() * 8) + 2;
            n2 = (sc as any).n2 || [2, 3, 4, 5][Math.floor(Math.random() * 4)];
            n1 = ans * n2;
            // Special case for user request: 15 / 5
            if (Math.random() < 0.1) { n1 = 15; n2 = 5; ans = 3; }
          }

          newQ = { 
            type: 'text', 
            q: sc.template.replace('{n1}', n1.toString()).replace('{n2}', n2.toString()), 
            ans: ans 
          };
        } else if (mathType === 'special_numbers') {
          const scenarios = [
            { q: "Hiệu của số bé nhất có 3 chữ số với số lớn nhất có 2 chữ số là:", ans: 1 },
            { q: "Tổng của số lớn nhất có 2 chữ số và số lớn nhất có 2 chữ số khác nhau là:", ans: 197 },
            { q: "Tổng của số lớn nhất có 2 chữ số khác nhau và số bé nhất có 3 chữ số giống nhau là:", ans: 209 },
            { q: "Tổng của số lớn nhất có 2 chữ số và số bé nhất có 3 chữ số khác nhau là:", ans: 201 },
            { q: "Hiệu của số lớn nhất có 3 chữ số và số bé nhất có 3 chữ số là:", ans: 899 },
            { q: "Số bé nhất có 3 chữ số khác nhau là:", ans: 102 },
            { q: "Số lớn nhất có 3 chữ số khác nhau là:", ans: 987 },
            { q: "Số bé nhất có 2 chữ số giống nhau là:", ans: 11 },
            { q: "Số lớn nhất có 2 chữ số giống nhau là:", ans: 99 }
          ];
          const sc = scenarios[Math.floor(Math.random() * scenarios.length)];
          newQ = { type: 'text', q: sc.q, ans: sc.ans, opts: [sc.ans, sc.ans + 1, sc.ans - 1, 100].filter((v, i, a) => a.indexOf(v) === i) };
        } else if (mathType === 'find_x') {
          const n1 = Math.floor(Math.random() * 400) + 100;
          const n2 = Math.floor(Math.random() * 300) + 50;
          const type = Math.floor(Math.random() * 2);
          if (type === 0) { // x - n1 = n2
            newQ = { type: 'text', q: `Tìm x biết: x - ${n1} = ${n2}`, ans: n1 + n2 };
          } else { // x + n1 = n2 (ensure n2 > n1)
            const n2_fixed = n1 + Math.floor(Math.random() * 200) + 10;
            newQ = { type: 'text', q: `Tìm x biết: x + ${n1} = ${n2_fixed}`, ans: n2_fixed - n1 };
          }
        } else if (mathType === 'geometry') {
          const scenarios = [
            {
              q: "Hình dưới đây có bao nhiêu hình tam giác?",
              ans: 10,
              opts: [8, 9, 10, 12],
              svg: (
                <svg viewBox="0 0 200 100" className="w-48 h-24 mx-auto mb-4">
                  <path d="M10 90 L60 10 L60 90 Z" fill="none" stroke="currentColor" strokeWidth="2" />
                  <rect x="60" y="10" width="100" height="80" fill="none" stroke="currentColor" strokeWidth="2" />
                  <line x1="60" y1="10" x2="160" y2="90" stroke="currentColor" strokeWidth="2" />
                  <line x1="160" y1="10" x2="60" y2="90" stroke="currentColor" strokeWidth="2" />
                </svg>
              )
            },
            {
              q: "Hình dưới đây có bao nhiêu hình tứ giác?",
              ans: 2,
              opts: [1, 2, 3, 4],
              svg: (
                <svg viewBox="0 0 200 100" className="w-48 h-24 mx-auto mb-4">
                  <path d="M10 90 L60 10 L60 90 Z" fill="none" stroke="currentColor" strokeWidth="2" />
                  <rect x="60" y="10" width="100" height="80" fill="none" stroke="currentColor" strokeWidth="2" />
                  <line x1="60" y1="10" x2="160" y2="90" stroke="currentColor" strokeWidth="2" />
                  <line x1="160" y1="10" x2="60" y2="90" stroke="currentColor" strokeWidth="2" />
                </svg>
              )
            },
            {
              q: "Hình dưới đây có bao nhiêu hình tam giác?",
              ans: 3,
              opts: [1, 2, 3, 4],
              svg: (
                <svg viewBox="0 0 100 100" className="w-24 h-24 mx-auto mb-4">
                  <path d="M50 10 L10 90 L90 90 Z" fill="none" stroke="currentColor" strokeWidth="2" />
                  <line x1="50" y1="10" x2="50" y2="90" stroke="currentColor" strokeWidth="2" />
                </svg>
              )
            },
            {
              q: "Hình dưới đây có bao nhiêu hình tứ giác?",
              ans: 3,
              opts: [1, 2, 3, 4],
              svg: (
                <svg viewBox="0 0 100 100" className="w-24 h-24 mx-auto mb-4">
                  <rect x="10" y="10" width="80" height="80" fill="none" stroke="currentColor" strokeWidth="2" />
                  <line x1="10" y1="50" x2="90" y2="50" stroke="currentColor" strokeWidth="2" />
                </svg>
              )
            },
            {
              q: "Hình dưới đây có bao nhiêu hình tam giác?",
              ans: 8,
              opts: [4, 6, 8, 10],
              svg: (
                <svg viewBox="0 0 100 100" className="w-24 h-24 mx-auto mb-4">
                  <rect x="10" y="10" width="80" height="80" fill="none" stroke="currentColor" strokeWidth="2" />
                  <line x1="10" y1="10" x2="90" y2="90" stroke="currentColor" strokeWidth="2" />
                  <line x1="90" y1="10" x2="10" y2="90" stroke="currentColor" strokeWidth="2" />
                </svg>
              )
            }
          ];
          const sc = scenarios[Math.floor(Math.random() * scenarios.length)];
          newQ = { type: 'text', q: sc.q, text: sc.svg, ans: sc.ans, opts: sc.opts };
        } else { // estimate
          const val = Math.floor(Math.random() * 90) + 10;
          const ans = Math.round(val / 10) * 10;
          newQ = { 
            type: 'text', 
            q: `Làm tròn số ${val} đến hàng chục gần nhất?`, 
            ans: ans,
            opts: [ans, ans - 10, ans + 10].filter(v => v >= 0)
          };
        }
      } else {
        // Grade 6 Math
        const g6Types = [
          'fraction_calc', 'fraction_calc', 
          'decimal_calc', 
          'percentage', 
          'solve_x', 'solve_x', 'solve_x',
          'reasonable_calc', 'reasonable_calc',
          'geometry', 
          'word_fraction'
        ];
        const g6Type = g6Types[Math.floor(Math.random() * g6Types.length)];
        
        const gcd = (x: number, y: number): number => y === 0 ? Math.abs(x) : gcd(y, x % y);
        const simplify = (n: number, d: number) => {
          const common = gcd(n, d);
          return { n: n / common, d: d / common };
        };

        if (g6Type === 'fraction_calc') {
          const a = Math.floor(Math.random() * 9) + 1;
          const b = Math.floor(Math.random() * 9) + 2;
          const c = Math.floor(Math.random() * 9) + 1;
          const d = Math.floor(Math.random() * 9) + 2;
          const op = ['+', '-', 'x', ':'][Math.floor(Math.random() * 4)];
          
          let num = 0, den = 1;
          if (op === '+') { num = a * d + c * b; den = b * d; }
          else if (op === '-') { num = a * d - c * b; den = b * d; }
          else if (op === 'x') { num = a * c; den = b * d; }
          else { num = a * d; den = b * c; }
          
          const { n: finalNum, d: finalDen } = simplify(num, den);
          const ansStr = finalDen === 1 ? `${finalNum}` : `${finalNum}/${finalDen}`;
          
          newQ = { 
            type: 'text', 
            q: 'Tính và rút gọn kết quả:',
            text: (
              <div className="flex items-center justify-center gap-2 text-4xl md:text-6xl font-black">
                <Fraction num={a} den={b} />
                <span className="text-orange-500">{op === 'x' ? '×' : (op === ':' ? '÷' : op)}</span>
                <Fraction num={c} den={d} />
                <span className="text-gray-300">= ?</span>
              </div>
            ),
            ans: ansStr 
          };
        } else if (g6Type === 'reasonable_calc') {
          // Reasonable calculation: a/b * c/d + a/b * e/d = a/b * (c/d + e/d)
          const a = Math.floor(Math.random() * 9) + 1;
          const b = Math.floor(Math.random() * 9) + 2;
          const d = Math.floor(Math.random() * 9) + 2;
          const c = Math.floor(Math.random() * (d - 1)) + 1;
          const e = d - c; 
          
          const { n: finalNum, d: finalDen } = simplify(a, b);
          const ansStr = finalDen === 1 ? `${finalNum}` : `${finalNum}/${finalDen}`;

          newQ = {
            type: 'text',
            q: 'Tính bằng cách hợp lý nhất:',
            text: (
              <div className="flex items-center justify-center gap-1 text-3xl md:text-5xl font-black flex-wrap">
                <Fraction num={a} den={b} />
                <span className="text-orange-500 mx-1">×</span>
                <Fraction num={c} den={d} />
                <span className="text-orange-500 mx-1">+</span>
                <Fraction num={a} den={b} />
                <span className="text-orange-500 mx-1">×</span>
                <Fraction num={e} den={d} />
                <span className="text-gray-300 ml-2">= ?</span>
              </div>
            ),
            ans: ansStr
          };
        } else if (g6Type === 'solve_x') {
          const type = Math.floor(Math.random() * 4);
          if (type === 0) {
            // x + a/b = c/d
            const b = Math.floor(Math.random() * 5) + 2;
            const d = b * 2;
            const a = Math.floor(Math.random() * (b - 1)) + 1;
            const c = Math.floor(Math.random() * 10) + 2 * a + 1;
            
            // x = c/d - a/b = (c - 2a)/d
            const num = c - 2 * a;
            const den = d;
            const { n: fn, d: fd } = simplify(num, den);
            const ansStr = fd === 1 ? `${fn}` : `${fn}/${fd}`;

            newQ = {
              type: 'text',
              q: 'Tìm x:',
              text: (
                <div className="flex items-center justify-center gap-2 text-4xl md:text-6xl font-black">
                  <span>x</span>
                  <span className="text-orange-500">+</span>
                  <Fraction num={a} den={b} />
                  <span className="text-gray-400">=</span>
                  <Fraction num={c} den={d} />
                </div>
              ),
              ans: ansStr
            };
          } else if (type === 1) {
            // x * a/b = c/d
            const a = Math.floor(Math.random() * 5) + 1;
            const b = Math.floor(Math.random() * 5) + 2;
            const c = Math.floor(Math.random() * 5) + 1;
            const d = Math.floor(Math.random() * 5) + 2;
            
            // x = (c/d) / (a/b) = (c*b)/(d*a)
            const num = c * b;
            const den = d * a;
            const { n: fn, d: fd } = simplify(num, den);
            const ansStr = fd === 1 ? `${fn}` : `${fn}/${fd}`;

            newQ = {
              type: 'text',
              q: 'Tìm x:',
              text: (
                <div className="flex items-center justify-center gap-2 text-4xl md:text-6xl font-black">
                  <span>x</span>
                  <span className="text-orange-500">×</span>
                  <Fraction num={a} den={b} />
                  <span className="text-gray-400">=</span>
                  <Fraction num={c} den={d} />
                </div>
              ),
              ans: ansStr
            };
          } else if (type === 2) {
            // a/b - x = c/d
            const b = Math.floor(Math.random() * 5) + 2;
            const a = Math.floor(Math.random() * 10) + 5;
            const d = b;
            const c = Math.floor(Math.random() * (a - 1)) + 1;
            
            // x = a/b - c/d = (a-c)/b
            const num = a - c;
            const den = b;
            const { n: fn, d: fd } = simplify(num, den);
            const ansStr = fd === 1 ? `${fn}` : `${fn}/${fd}`;

            newQ = {
              type: 'text',
              q: 'Tìm x:',
              text: (
                <div className="flex items-center justify-center gap-2 text-4xl md:text-6xl font-black">
                  <Fraction num={a} den={b} />
                  <span className="text-orange-500">-</span>
                  <span>x</span>
                  <span className="text-gray-400">=</span>
                  <Fraction num={c} den={d} />
                </div>
              ),
              ans: ansStr
            };
          } else {
            // Basic integer solve x
            const a = Math.floor(Math.random() * 20) + 1;
            const ans = Math.floor(Math.random() * 30) + 1;
            newQ = { 
              type: 'text', 
              q: 'Tìm x:', 
              text: <div className="text-4xl md:text-6xl font-black">x + {a} = {a + ans}</div>, 
              ans: ans 
            };
          }
        } else if (g6Type === 'decimal_calc') {
          const n1 = (Math.random() * 100).toFixed(2);
          const n2 = (Math.random() * 100).toFixed(2);
          const op = ['+', '-', 'x'][Math.floor(Math.random() * 3)];
          let ans = 0;
          if (op === '+') ans = parseFloat(n1) + parseFloat(n2);
          else if (op === '-') ans = parseFloat(n1) - parseFloat(n2);
          else ans = parseFloat(n1) * parseFloat(n2);
          newQ = { type: 'text', q: `Tính: ${n1} ${op} ${n2} = ?`, ans: parseFloat(ans.toFixed(2)) };
        } else if (g6Type === 'percentage') {
          const p = [5, 10, 15, 20, 25, 30, 40, 50, 75][Math.floor(Math.random() * 9)];
          const total = [100, 200, 400, 500, 800, 1000, 1200, 1500][Math.floor(Math.random() * 8)];
          const type = Math.random() < 0.5;
          if (type) {
            newQ = { type: 'text', q: `Tính ${p}% của ${total}?`, ans: (p * total) / 100 };
          } else {
            const val = (p * total) / 100;
            newQ = { type: 'text', q: `Biết ${p}% của một số là ${val}. Tìm số đó?`, ans: total };
          }
        } else if (g6Type === 'solve_x') {
          const type = Math.floor(Math.random() * 3);
          if (type === 0) {
            const a = Math.floor(Math.random() * 20) + 1;
            const ans = Math.floor(Math.random() * 30) + 1;
            newQ = { type: 'text', q: `Tìm x biết: x + ${a} = ${a + ans}`, ans: ans };
          } else if (type === 1) {
            const a = Math.floor(Math.random() * 10) + 1;
            const ans = Math.floor(Math.random() * 10) + 1;
            newQ = { type: 'text', q: `Tìm x biết: x * ${a} = ${a * ans}`, ans: ans };
          } else {
            const a = Math.floor(Math.random() * 50) + 10;
            const ans = Math.floor(Math.random() * 40) + 5;
            newQ = { type: 'text', q: `Tìm x biết: ${a} - x = ${a - ans}`, ans: ans };
          }
        } else if (g6Type === 'geometry') {
          const scenarios = [
            { q: "Cho đoạn thẳng AB dài {len}cm. M là trung điểm của AB. Tính AM?", factor: 0.5 },
            { q: "Cho M là trung điểm đoạn thẳng AB. Biết AM = {len}cm. Tính AB?", factor: 2 }
          ];
          const sc = scenarios[Math.floor(Math.random() * scenarios.length)];
          const len = (Math.floor(Math.random() * 15) + 1) * 2;
          newQ = { type: 'text', q: sc.q.replace('{len}', len.toString()), ans: len * sc.factor };
        } else {
          const scenarios = [
            { q: "Một lớp học có {total} học sinh. Số học sinh nữ chiếm {num}/{den} cả lớp. Tính số học sinh nữ?", op: '*' },
            { q: "Quãng đường AB dài {total}km. Ô tô đã đi được {num}/{den} quãng đường. Tính quãng đường còn lại?", op: 'rem' }
          ];
          const sc = scenarios[Math.floor(Math.random() * scenarios.length)];
          const den = [4, 5, 8, 10][Math.floor(Math.random() * 4)];
          const num = Math.floor(Math.random() * (den - 1)) + 1;
          const total = den * (Math.floor(Math.random() * 20) + 5);
          const sold = (total * num) / den;
          const ans = sc.op === '*' ? sold : total - sold;
          newQ = { 
            type: 'text', 
            q: 'Giải toán có lời văn:',
            text: (
              <div className="text-left">
                <p className="mb-4">{sc.q.replace('{total}', total.toString()).replace('{num}', '').replace('{den}', '').replace('{num}/{den}', '')}</p>
                <div className="flex items-center gap-2">
                  <span>Biết tỉ số là:</span>
                  <Fraction num={num} den={den} />
                </div>
              </div>
            ),
            ans: ans 
          };
        }
      }
    } else if (subject === 'vietnamese') {
      const item = VIETNAMESE_DATA[Math.floor(Math.random() * VIETNAMESE_DATA.length)];
      newQ = { type: 'text', q: item.q, text: item.text, ans: item.ans, opts: item.opts };
    } else {
      const item = ENGLISH_DATA[Math.floor(Math.random() * ENGLISH_DATA.length)];
      newQ = { type: 'text', q: item.q, text: item.text, ans: item.ans, opts: item.opts };
    }

    // Generate options for quiz or text-based questions
    if (gameMode === 'quiz' || newQ.type === 'text') {
      if (!newQ.opts) {
        const ans = (newQ.answer !== undefined ? newQ.answer : newQ.ans);
        if (typeof ans === 'number') {
          const opts = [ans];
          while (opts.length < 4) {
            const offset = Math.floor(Math.random() * 20) - 10;
            const wrong = ans + (offset === 0 ? 7 : offset);
            if (wrong >= 0 && !opts.includes(wrong)) opts.push(wrong);
          }
          newQ.opts = opts.sort(() => Math.random() - 0.5);
        } else if (typeof ans === 'string') {
          if (newQ.operator === '?') {
            newQ.opts = ['>', '<', '='];
          } else if (ans.includes('/')) {
            const parts = ans.split('/');
            if (parts.length === 2) {
              const n = parseInt(parts[0]);
              const d = parseInt(parts[1]);
              const opts = [ans];
              while (opts.length < 4) {
                const nOff = Math.floor(Math.random() * 5) - 2;
                const dOff = Math.floor(Math.random() * 5) - 2;
                const wn = Math.max(1, n + (nOff === 0 ? 1 : nOff));
                const wd = Math.max(2, d + (dOff === 0 ? 1 : dOff));
                const wans = `${wn}/${wd}`;
                if (!opts.includes(wans)) opts.push(wans);
              }
              newQ.opts = opts.sort(() => Math.random() - 0.5);
            }
          }
        }
      } else {
        // Don't shuffle comparison operators
        if (newQ.operator !== '?') {
          newQ.opts = [...newQ.opts].sort(() => Math.random() - 0.5);
        }
      }
    }

    setQuestion(newQ);
    saveQuestionToFirestore(newQ);
    setUserAnswer('');
    setTimeLeft(30);
    setFeedback(null);
  }, [subject, gameMode, grade, isAuthReady, user]);

  const startGame = () => {
    setScore(0);
    setQuizIndex(0);
    setGameState('playing');
    generateQuestion();
  };

  const handleFirework = () => {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      zIndex: 2000
    });
  };

  const handleAnswer = (val: string | number) => {
    if (!question || feedback) return;
    
    const correctAns = question.type === 'math' ? question.answer : question.ans;
    let isCorrect = val.toString().toLowerCase().trim() === correctAns?.toString().toLowerCase().trim();

    // Special check for fractions (e.g., 1/2 vs 2/4)
    if (!isCorrect && correctAns !== undefined) {
      const v = val.toString().trim();
      const c = correctAns.toString().trim();
      
      const getFraction = (s: string) => {
        if (s.includes('/')) {
          const [n, d] = s.split('/').map(Number);
          return d !== 0 ? { n, d } : null;
        }
        const n = Number(s);
        return !isNaN(n) ? { n, d: 1 } : null;
      };

      const f1 = getFraction(v);
      const f2 = getFraction(c);
      
      if (f1 && f2) {
        isCorrect = f1.n * f2.d === f2.n * f1.d;
      }
    }

    if (isCorrect) {
      setScore(s => s + 1);
      setFeedback('correct');
      handleFirework();
    } else {
      setFeedback('wrong');
    }

    setTimeout(() => {
      if (gameMode === 'quiz') {
        if (quizIndex < 9) {
          setQuizIndex(i => i + 1);
          generateQuestion();
        } else {
          saveScoreToFirestore(isCorrect ? score + 1 : score);
          setGameState('result');
        }
      } else {
        if (isCorrect) generateQuestion();
        else {
          setFeedback(null);
          setUserAnswer('');
        }
      }
    }, isCorrect ? 1500 : 1000);
  };

  useEffect(() => {
    let timer: any;
    if (gameState === 'playing' && timeLeft > 0 && !feedback && gameMode === 'endless') {
      timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    } else if (timeLeft === 0 && gameState === 'playing' && gameMode === 'endless') {
      setGameState('result');
    }
    return () => clearInterval(timer);
  }, [gameState, timeLeft, feedback, gameMode]);

  useEffect(() => {
    if (gameState === 'playing' && inputRef.current && !question?.opts) {
      inputRef.current.focus();
    }
  }, [gameState, question]);

  return (
    <div className="min-h-screen bg-yellow-50 font-sans text-gray-800 flex flex-col items-center justify-center p-4">
      <AnimatePresence mode="wait">
        {gameState === 'setup' && (
          <motion.div
            key="setup"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="text-center bg-white p-8 rounded-3xl shadow-xl border-4 border-yellow-400 max-w-md w-full"
          >
            <h1 className="text-3xl font-black text-orange-500 mb-6">Chào bé! Tên bé là gì nhỉ?</h1>
            <div className="mb-8 relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Nhập tên của bé..."
                className="w-full pl-12 pr-4 py-4 text-xl font-bold border-4 border-blue-100 rounded-2xl focus:border-blue-400 focus:outline-none transition-all text-center"
              />
            </div>
            <h2 className="text-xl font-bold text-gray-500 mb-4 text-left">Chọn lớp học:</h2>
            <div className="grid grid-cols-2 gap-4 mb-8">
              {['2', '6'].map(g => (
                <button
                  key={g}
                  onClick={() => setGrade(g as Grade)}
                  className={`py-4 rounded-2xl border-4 font-bold text-xl transition-all ${
                    grade === g ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-gray-100 bg-white text-gray-400'
                  }`}
                >
                  Lớp {g}
                </button>
              ))}
            </div>
            <h2 className="text-xl font-bold text-gray-500 mb-4 text-left">Chọn bạn đồng hành:</h2>
            <div className="grid grid-cols-3 gap-3 mb-8">
              {ANIMAL_ICONS.map(a => (
                <button
                  key={a.id}
                  onClick={() => setSelectedIconId(a.id)}
                  className={`p-3 rounded-2xl border-4 transition-all flex flex-col items-center gap-1 ${
                    selectedIconId === a.id ? 'border-orange-400 bg-orange-50 scale-105' : 'border-gray-50 bg-white'
                  }`}
                >
                  <a.Icon className={`w-10 h-10 ${a.color}`} />
                  <span className="text-[10px] font-bold text-gray-400">{a.label}</span>
                </button>
              ))}
            </div>

            {loginError && (
              <div className="mb-4">
                <div className="p-4 bg-red-50 border-2 border-red-200 rounded-2xl text-red-600 text-sm font-medium mb-2">
                  {loginError}
                </div>
                <button 
                  onClick={() => handleLogin(true)}
                  className="w-full py-2 text-sm font-bold text-blue-600 hover:underline"
                >
                  Thử đăng nhập bằng cách Chuyển hướng trang
                </button>
              </div>
            )}

            <button
              onClick={() => {
                if (!user) {
                  handleLogin();
                } else {
                  setGameState('subject_select');
                }
              }}
              disabled={!playerName.trim()}
              className="w-full bg-green-500 hover:bg-green-600 disabled:bg-gray-200 text-white text-2xl font-bold py-4 rounded-full shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              {!user ? "Đăng nhập với Google" : "Tiếp tục"}
            </button>
          </motion.div>
        )}

        {gameState === 'subject_select' && (
          <motion.div
            key="subject_select"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center bg-white p-8 rounded-3xl shadow-xl border-4 border-blue-400 max-w-md w-full"
          >
            <h2 className="text-2xl font-bold text-blue-600 mb-6">Bé muốn học môn gì?</h2>
            <div className="grid grid-cols-1 gap-4">
              {SUBJECTS.map(s => (
                <button
                  key={s.id}
                  onClick={() => { 
                    setSubject(s.id as SubjectId); 
                    if (s.id === 'math' && grade === '2') {
                      setGameState('topic_select');
                    } else {
                      setGameState('mode_select');
                    }
                  }}
                  className="p-5 rounded-2xl border-4 border-gray-100 hover:border-blue-300 transition-all flex items-center gap-4 text-left group"
                >
                  <div className={`${s.color} p-3 rounded-xl text-white group-hover:scale-110 transition-transform`}>
                    <s.Icon />
                  </div>
                  <div>
                    <div className="font-bold text-xl text-gray-700">{s.name}</div>
                    <div className="text-sm text-gray-400">{s.desc}</div>
                  </div>
                </button>
              ))}
            </div>
            <button onClick={() => setGameState('setup')} className="mt-6 text-gray-400 font-bold hover:text-gray-600">Quay lại</button>
          </motion.div>
        )}

        {gameState === 'topic_select' && (
          <motion.div
            key="topic_select"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center bg-white p-8 rounded-3xl shadow-xl border-4 border-orange-400 max-w-2xl w-full"
          >
            <h2 className="text-2xl font-bold text-orange-600 mb-6">Bé muốn luyện tập chủ đề nào?</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {MATH_TOPICS_G2.map(t => (
                <button
                  key={t.id}
                  onClick={() => { setSelectedTopic(t.id); setGameState('mode_select'); }}
                  className="p-4 rounded-2xl border-4 border-gray-100 hover:border-orange-300 transition-all flex items-center gap-4 text-left group"
                >
                  <div className={`p-3 rounded-xl bg-orange-50 ${t.color} group-hover:scale-110 transition-transform`}>
                    <t.Icon size={24} />
                  </div>
                  <div>
                    <div className="font-bold text-lg text-gray-700">{t.name}</div>
                    <div className="text-xs text-gray-400 leading-tight">{t.desc}</div>
                  </div>
                </button>
              ))}
            </div>
            <button onClick={() => setGameState('subject_select')} className="mt-8 text-gray-400 font-bold hover:text-gray-600">Quay lại</button>
          </motion.div>
        )}

        {gameState === 'mode_select' && (
          <motion.div
            key="mode_select"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center bg-white p-8 rounded-3xl shadow-xl border-4 border-blue-400 max-w-md w-full"
          >
            <h2 className="text-2xl font-bold text-blue-600 mb-8">Chọn chế độ chơi</h2>
            <div className="space-y-4">
              <button
                onClick={() => { setGameMode('endless'); setGameState('start'); }}
                className="w-full p-6 bg-orange-50 border-4 border-orange-200 rounded-2xl flex items-center gap-4 hover:bg-orange-100 transition-all group"
              >
                <div className="p-3 bg-orange-500 text-white rounded-xl group-hover:scale-110 transition-transform"><Zap /></div>
                <div className="text-left">
                  <div className="text-xl font-black text-orange-600">Luyện tập tự do</div>
                  <div className="text-sm text-gray-400">Làm bao nhiêu tùy thích!</div>
                </div>
              </button>
              <button
                onClick={() => { setGameMode('quiz'); setGameState('start'); }}
                className="w-full p-6 bg-blue-50 border-4 border-blue-200 rounded-2xl flex items-center gap-4 hover:bg-blue-100 transition-all group"
              >
                <div className="p-3 bg-blue-500 text-white rounded-xl group-hover:scale-110 transition-transform"><ListChecks /></div>
                <div className="text-left">
                  <div className="text-xl font-black text-blue-600">Đề trắc nghiệm</div>
                  <div className="text-sm text-gray-400">Thử thách 10 câu hỏi!</div>
                </div>
              </button>
            </div>
            <button 
              onClick={() => {
                if (subject === 'math' && grade === '2') {
                  setGameState('topic_select');
                } else {
                  setGameState('subject_select');
                }
              }} 
              className="mt-8 text-gray-400 font-bold hover:text-gray-600"
            >
              Quay lại
            </button>
          </motion.div>
        )}

        {gameState === 'start' && (
          <motion.div
            key="start"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center bg-white p-8 rounded-3xl shadow-xl border-4 border-yellow-400 max-w-md w-full"
          >
            <div className="mb-6 flex justify-center">
              <div className="p-6 bg-orange-50 rounded-full border-4 border-orange-100">
                <SelectedAnimal.Icon className={`w-24 h-24 ${SelectedAnimal.color}`} />
              </div>
            </div>
            <h1 className="text-4xl font-black text-orange-500 mb-2">Chào {playerName}!</h1>
            <p className="text-lg text-gray-500 mb-8">
              Môn học: <span className="font-bold text-blue-500">{SUBJECTS.find(s => s.id === subject)?.name}</span>
            </p>
            <button
              onClick={startGame}
              className="w-full bg-green-500 hover:bg-green-600 text-white text-2xl font-bold py-4 rounded-full shadow-lg transition-all active:scale-95"
            >
              Bắt đầu ngay
            </button>
          </motion.div>
        )}

        {gameState === 'playing' && question && (
          <motion.div
            key="playing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="w-full max-w-2xl"
          >
            <div className="flex flex-col sm:flex-row justify-between items-center mb-6 bg-white p-4 rounded-2xl shadow-md border-2 border-orange-100 gap-4">
              <div className="flex items-center gap-3">
                <SelectedAnimal.Icon className={`w-8 h-8 ${SelectedAnimal.color}`} />
                <span className="font-bold text-gray-600">{playerName}</span>
                <button 
                  onClick={() => setGameState('mode_select')}
                  className="ml-2 px-3 py-1 bg-gray-100 text-gray-500 text-sm font-bold rounded-lg hover:bg-red-50 hover:text-red-500 transition-colors"
                >
                  Thoát
                </button>
              </div>
              <div className="flex items-center gap-6">
                {gameMode === 'quiz' ? (
                  <div className="text-blue-500 font-bold text-xl">Câu {quizIndex + 1}/10</div>
                ) : (
                  <div className={`flex items-center gap-2 font-bold text-xl ${timeLeft < 10 ? 'text-red-500 animate-pulse' : 'text-blue-500'}`}>
                    <Timer /> <span>{timeLeft}s</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-orange-500 font-bold text-xl">
                  <Trophy className="text-yellow-500" /> <span>{score}</span>
                </div>
              </div>
            </div>

            <div className="bg-white p-10 rounded-3xl shadow-2xl border-b-8 border-blue-100 text-center relative overflow-hidden">
              <AnimatePresence>
                {feedback === 'correct' && (
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 flex items-center justify-center bg-green-50 z-10 opacity-90">
                    <CheckCircle2 className="w-32 h-32 text-green-500" />
                  </motion.div>
                )}
                {feedback === 'wrong' && (
                  <motion.div initial={{ x: -10 }} animate={{ x: 10 }} transition={{ repeat: 5, duration: 0.1 }} exit={{ opacity: 0 }} className="absolute inset-0 flex items-center justify-center bg-red-50 z-10 opacity-90">
                    <XCircle className="w-32 h-32 text-red-500" />
                  </motion.div>
                )}
              </AnimatePresence>

              {question.type === 'math' ? (
                <div className="text-6xl md:text-8xl font-black text-gray-700 mb-12 flex flex-wrap items-center justify-center gap-4">
                  <span>{question.num1}</span>
                  <span className="text-orange-500">{['>', '<', '=', '?'].includes(question.operator!) ? '?' : (question.operator === 'x' ? '×' : (question.operator === ':' ? '÷' : question.operator))}</span>
                  <span>{question.num2}</span>
                  {!['>', '<', '=', '?'].includes(question.operator!) && <span className="text-gray-300">= ?</span>}
                </div>
              ) : (
                <div className="mb-10">
                  <div className="text-xl text-blue-500 font-bold mb-4">{question.q}</div>
                  <div className="text-4xl font-black text-gray-700">{question.text}</div>
                </div>
              )}

              {question.opts ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {question.opts.map((o, i) => (
                    <button
                      key={i}
                      onClick={() => handleAnswer(o)}
                      className="p-5 bg-blue-50 border-4 border-blue-100 rounded-2xl text-2xl font-bold text-blue-600 hover:bg-blue-100 transition-all active:scale-95 flex items-center justify-center"
                    >
                      {typeof o === 'string' && o.includes('/') ? (
                        <Fraction num={o.split('/')[0]} den={o.split('/')[1]} />
                      ) : o}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center gap-6">
                  {['>', '<', '=', '?'].includes(question.operator!) ? (
                    <div className="flex gap-4">
                      {['>', '<', '='].map(op => (
                        <button
                          key={op}
                          onClick={() => handleAnswer(op)}
                          className="w-20 h-20 bg-blue-500 text-white text-4xl font-bold rounded-2xl shadow-lg transition-all active:scale-95"
                        >
                          {op}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <form onSubmit={(e) => { e.preventDefault(); handleAnswer(userAnswer); }}>
                      <input
                        ref={inputRef}
                        type="text"
                        value={userAnswer}
                        onChange={(e) => setUserAnswer(e.target.value)}
                        disabled={!!feedback}
                        placeholder={grade === '6' ? "vd: 1/2" : "?"}
                        className="w-48 p-4 text-4xl border-4 border-blue-100 rounded-2xl text-center outline-none focus:border-blue-400 bg-blue-50 text-blue-700"
                      />
                      <div className="mt-8">
                        <button type="submit" disabled={!!feedback || userAnswer === ''} className="bg-blue-500 hover:bg-blue-600 text-white text-2xl font-bold py-4 px-12 rounded-2xl shadow-lg transition-all active:scale-95">Kiểm tra</button>
                      </div>
                    </form>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {gameState === 'result' && (
          <motion.div
            key="result"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center bg-white p-10 rounded-3xl shadow-2xl border-4 border-orange-400 max-w-md w-full"
          >
            <Trophy className="w-20 h-20 text-yellow-500 mx-auto mb-4" />
            <h2 className="text-4xl font-black text-gray-700 mb-2">{score >= 8 ? 'TUYỆT VỜI!' : 'KHÁ LẮM!'}</h2>
            <p className="text-xl text-gray-500 mb-8">
              {playerName} đạt được <span className="text-orange-500 font-bold">{score}</span> {gameMode === 'quiz' ? '/ 10' : ''} điểm môn {SUBJECTS.find(s => s.id === subject)?.name}!
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={startGame}
                className="bg-green-500 hover:bg-green-600 text-white text-2xl font-bold py-4 rounded-full shadow-lg transition-all active:scale-95 flex items-center justify-center gap-3"
              >
                <RefreshCw /> Chơi lại
              </button>
              {subject === 'math' && grade === '2' && (
                <button 
                  onClick={() => setGameState('topic_select')} 
                  className="bg-blue-500 hover:bg-blue-600 text-white text-xl font-bold py-3 rounded-full shadow-md transition-all active:scale-95"
                >
                  Chọn chủ đề khác
                </button>
              )}
              <button onClick={() => setGameState('subject_select')} className="text-gray-400 font-bold hover:text-gray-600">Chọn môn khác</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-12 flex gap-4 opacity-30">
        <Star className="text-yellow-400 animate-bounce" />
        <Star className="text-blue-400 animate-bounce" style={{ animationDelay: '0.1s' }} />
        <Star className="text-green-400 animate-bounce" style={{ animationDelay: '0.2s' }} />
      </div>
    </div>
  );
}
