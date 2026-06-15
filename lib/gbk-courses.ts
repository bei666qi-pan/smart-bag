// 课表下行用的课程名 → GBK 字节(hex) 静态表。
//
// 为什么用静态表而不是在浏览器里做 UTF-8→GBK 转换：
//  1) 书包屏幕的 class1..class4 控件用的是 GBK 字库，必须发 GBK 字节；
//  2) 浏览器没有内置 GBK 编码器，引第三方库（iconv-lite 等）既增体积又增部署复杂度；
//  3) 屏幕 GBK 字库本身只含部分字形，限定在"确认能正常显示"的常见课程更可靠。
// hex 由 Python `name.encode('gbk').hex()` 预先算好。ESP32 端收到后解码成裸字节直接写控件，
// 全链路只在这一处维护编码，端侧保持"哑终端"。
export type GbkCourse = { name: string; hex: string }

export const GBK_COURSES: GbkCourse[] = [
  { name: "语文", hex: "d3efcec4" },
  { name: "数学", hex: "cafdd1a7" },
  { name: "英语", hex: "d3a2d3ef" },
  { name: "科学", hex: "bfc6d1a7" },
  { name: "体育", hex: "cce5d3fd" },
  { name: "音乐", hex: "d2f4c0d6" },
  { name: "美术", hex: "c3c0caf5" },
  { name: "道法", hex: "b5c0b7a8" },
  { name: "品德", hex: "c6b7b5c2" },
  { name: "班会", hex: "b0e0bbe1" },
  { name: "阅读", hex: "d4c4b6c1" },
  { name: "写字", hex: "d0b4d7d6" },
  { name: "书法", hex: "cae9b7a8" },
  { name: "历史", hex: "c0facab7" },
  { name: "地理", hex: "b5d8c0ed" },
  { name: "生物", hex: "c9faceef" },
  { name: "物理", hex: "ceefc0ed" },
  { name: "化学", hex: "bbafd1a7" },
  { name: "政治", hex: "d5fed6ce" },
  { name: "信息", hex: "d0c5cfa2" },
  { name: "劳动", hex: "c0cdb6af" },
  { name: "心理", hex: "d0c4c0ed" },
  { name: "自习", hex: "d7d4cfb0" },
  { name: "午休", hex: "cee7d0dd" },
  { name: "升旗", hex: "c9fdc6ec" },
  { name: "综合", hex: "d7dbbacf" },
  { name: "手工", hex: "cad6b9a4" },
  { name: "国学", hex: "b9fad1a7" },
  { name: "编程", hex: "b1e0b3cc" },
  { name: "实验", hex: "cab5d1e9" },
  { name: "健康", hex: "bda1bfb5" },
]

export const GBK_COURSE_BY_NAME: Record<string, string> = Object.fromEntries(
  GBK_COURSES.map((c) => [c.name, c.hex]),
)

export type TimetableSlot = { course: string; time: string }

// 构造 set_timetable 的 value：每段 "<课程名hex>,<HH:MM>"，分号分隔，最多 4 段。
// 不在表中的课程名（自定义）无法可靠 GBK 编码，调用方应只允许从 GBK_COURSES 选择；
// 这里对未知名按空串处理（清空该格），避免发出乱码。
export function buildTimetablePayload(slots: TimetableSlot[]): string {
  return slots
    .slice(0, 4)
    .map((s) => {
      const hex = GBK_COURSE_BY_NAME[s.course?.trim()] ?? ""
      const time = (s.time ?? "").trim()
      return `${hex},${time}`
    })
    .join(";")
}
