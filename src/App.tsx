/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef, FormEvent } from 'react';
import confetti from 'canvas-confetti';
import { 
  Trophy, Timer, Star, RefreshCw, Play, CheckCircle2, XCircle, 
  Cat, Dog, Rabbit, Bird, Fish, Turtle, User, 
  Book, Pen, Globe, Zap, ListChecks 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { auth, db } from './firebase';
import { signInAnonymously, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
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
];

const ENGLISH_DATA = [
  { q: "Màu 'Red' là màu gì?", text: "", ans: "Màu đỏ", opts: ["Màu đỏ", "Màu xanh", "Màu vàng"] },
  { q: "'Con mèo' tiếng Anh là gì?", text: "", ans: "Cat", opts: ["Dog", "Cat", "Rabbit"] },
  { q: "Số 'Five' là số mấy?", text: "", ans: "5", opts: ["3", "4", "5"] },
  { q: "'Apple' là quả gì?", text: "", ans: "Quả táo", opts: ["Quả táo", "Quả cam", "Quả chuối"] },
  { q: "Màu 'Blue' là màu gì?", text: "", ans: "Màu xanh dương", opts: ["Màu xanh lá", "Màu xanh dương", "Màu tím"] },
  { q: "'Hello' nghĩa là gì?", text: "", ans: "Xin chào", opts: ["Xin chào", "Tạm biệt", "Cảm ơn"] },
  { q: "'Elephant' là con gì?", text: "", ans: "Con voi", opts: ["Con voi", "Con hổ", "Con hươu"] }
];

export default function App() {
  const [gameState, setGameState] = useState<'setup' | 'subject_select' | 'mode_select' | 'start' | 'playing' | 'result'>('setup');
  const [subject, setSubject] = useState<SubjectId>('math');
  const [grade, setGrade] = useState<Grade>('2');
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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      if (u) {
        setUser(u);
        setIsAuthReady(true);
      } else {
        signInAnonymously(auth).catch(err => console.error("Auth error:", err));
      }
    });
    return () => unsubscribe();
  }, []);

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
        const mathTypes = ['calc', 'compare', 'unit', 'word', 'estimate', 'digits', 'unit_choice', 'multi_step'];
        const mathType = mathTypes[Math.floor(Math.random() * mathTypes.length)];
        
        if (mathType === 'calc') {
          const ops: Operator[] = ['+', '-', 'x', ':'];
          const operator = ops[Math.floor(Math.random() * ops.length)];
          let n1: number = 0, n2: number = 0, ans: number = 0;

          if (operator === '+' || operator === '-') {
            const is3Digit = Math.random() < 0.7; // Even more 3-digit questions
            const max = is3Digit ? 999 : 100;
            if (operator === '+') {
              n1 = Math.floor(Math.random() * (max - 10)) + 1;
              n2 = Math.floor(Math.random() * (max - n1)) + 1;
              ans = n1 + n2;
            } else {
              n1 = Math.floor(Math.random() * (max - 2)) + 2;
              n2 = Math.floor(Math.random() * n1) + 1;
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
          newQ = { type: 'math', num1: n1, num2: n2, operator, answer: ans };
        } else if (mathType === 'multi_step') {
          const type = Math.floor(Math.random() * 3);
          let q = "", ans = 0;
          if (type === 0) { // a * b + c
            const a = [2,3,4,5,6,7,8,9][Math.floor(Math.random()*8)];
            const b = Math.floor(Math.random()*9)+1;
            const c = Math.floor(Math.random()*500)+100;
            ans = a * b + c;
            q = `${a} x ${b} + ${c} = ?`;
          } else if (type === 1) { // a - b + c
            const a = Math.floor(Math.random()*500)+100;
            const b = Math.floor(Math.random()*a)+1;
            const c = Math.floor(Math.random()*500)+100;
            ans = a - b + c;
            q = `${a} - ${b} + ${c} = ?`;
          } else { // a + b - c
            const a = Math.floor(Math.random()*500)+100;
            const b = Math.floor(Math.random()*400)+100;
            const c = Math.floor(Math.random()*(a+b-10))+1;
            ans = a + b - c;
            q = `${a} + ${b} - ${c} = ?`;
          }
          newQ = { type: 'text', q, ans };
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
            { q: "Độ dài bút chì là 12 ...", ans: "cm" },
            { q: "Độ dài cái bàn là 8 ...", ans: "dm" },
            { q: "Chiều cao bạn Nam là 115 ...", ans: "cm" },
            { q: "Quãng đường từ nhà An đến trường là 3 ...", ans: "km" },
            { q: "Bàn học cao 50 ...", ans: "cm" },
            { q: "Quãng đường từ Hà Nội đến Hải Phòng là 120 ...", ans: "km" },
            { q: "Quyển sách Toán dày khoảng 1 ...", ans: "cm" },
            { q: "Cột cờ trường em cao 10 ...", ans: "m" },
            { q: "Độ dài sải tay của em khoảng 1 ...", ans: "m" }
          ];
          const sc = scenarios[Math.floor(Math.random() * scenarios.length)];
          newQ = {
            type: 'text',
            q: sc.q,
            ans: sc.ans,
            opts: ['cm', 'm', 'dm', 'km']
          };
        } else if (mathType === 'compare') {
          const is3Digit = Math.random() < 0.4;
          const max = is3Digit ? 999 : 100;
          const v1 = Math.floor(Math.random() * max);
          const v2 = Math.floor(Math.random() * max);
          const ans = v1 > v2 ? '>' : (v1 < v2 ? '<' : '=');
          newQ = { type: 'math', num1: v1, num2: v2, operator: '?', answer: ans, opts: ['>', '<', '='] };
        } else if (mathType === 'unit') {
          const units = [
            { from: 'km', to: 'm', factor: 1000 },
            { from: 'm', to: 'cm', factor: 100 },
            { from: 'm', to: 'dm', factor: 10 },
            { from: 'dm', to: 'cm', factor: 10 }
          ];
          const unit = units[Math.floor(Math.random() * units.length)];
          const val = Math.floor(Math.random() * 9) + 1;
          const correctAns = val * unit.factor;
          
          // Generate challenging options (powers of 10 or common mistakes)
          const opts = [correctAns];
          const possibleMistakes = [val * 10, val * 100, val * 1000, val * 10000].filter(v => v !== correctAns);
          while (opts.length < 4 && possibleMistakes.length > 0) {
            const m = possibleMistakes.shift();
            if (m && !opts.includes(m)) opts.push(m);
          }
          // Fill remaining if any
          while (opts.length < 4) {
            const wrong = correctAns + (Math.random() < 0.5 ? 100 : -50);
            if (wrong > 0 && !opts.includes(wrong)) opts.push(wrong);
          }

          newQ = { 
            type: 'text', 
            q: `Đổi đơn vị: ${val} ${unit.from} = ... ${unit.to}?`, 
            ans: correctAns,
            opts: opts
          };
        } else if (mathType === 'word') {
          const scenarios = [
            { template: "An có {n1}kg gạo, Bình có {n2}kg gạo. Cả hai có bao nhiêu kg?", op: '+' },
            { template: "Mẹ mua {n1}l dầu, dùng hết {n2}l. Còn lại bao nhiêu lít?", op: '-' },
            { template: "Mỗi túi có {n1} quả cam. 5 túi có bao nhiêu quả?", op: 'x', n2: 5 },
            { template: "Một nhà máy sáng nay sản xuất được {n1} chiếc bánh mì tròn và {n2} chiếc bánh mì dẹt. Hỏi sáng nay nhà máy sản xuất được tất cả bao nhiêu chiếc bánh mì?", op: '+' },
            { template: "Một cửa hàng bán đồ thể thao đã nhập về {n1} quả bóng đá, số quả bóng rổ cửa hàng nhập về nhiều hơn số quả bóng đá {n2} quả. Hỏi cửa hàng đã nhập về bao nhiêu quả bóng rổ?", op: '+' }
          ];
          const sc = scenarios[Math.floor(Math.random() * scenarios.length)];
          const isLarge = Math.random() < 0.5;
          const n1 = isLarge ? Math.floor(Math.random() * 500) + 100 : Math.floor(Math.random() * 50) + 10;
          const n2 = sc.n2 || (isLarge ? Math.floor(Math.random() * 400) + 50 : Math.floor(Math.random() * n1) + 1);
          const ans = sc.op === '+' ? n1 + n2 : (sc.op === '-' ? n1 - n2 : n1 * n2);
          newQ = { 
            type: 'text', 
            q: sc.template.replace('{n1}', n1.toString()).replace('{n2}', n2.toString()), 
            ans: ans 
          };
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
            <button
              onClick={() => setGameState('subject_select')}
              disabled={!playerName.trim()}
              className="w-full bg-green-500 hover:bg-green-600 disabled:bg-gray-200 text-white text-2xl font-bold py-4 rounded-full shadow-lg transition-all active:scale-95"
            >
              Tiếp tục
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
                  onClick={() => { setSubject(s.id as SubjectId); setGameState('mode_select'); }}
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
            <button onClick={() => setGameState('subject_select')} className="mt-8 text-gray-400 font-bold hover:text-gray-600">Quay lại</button>
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
