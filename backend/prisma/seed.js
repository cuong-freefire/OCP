import prismaPackage from '@prisma/client';

const { PrismaClient } = prismaPackage;
const prisma = new PrismaClient();

async function main() {
  console.log('Seeding quiz data...');

  // Get or create a sample course (if courses table exists)
  let course;
  try {
    course = await prisma.course.findFirst();
  } catch {
    console.log('No course table found, skipping course lookup.');
  }

  // Create sample quizzes if none exist
  const existingQuizzes = await prisma.quiz.count().catch(() => 0);
  if (existingQuizzes > 0) {
    console.log('Quizzes already seeded. Skipping.');
    return;
  }

  // Create a quiz
  const quiz = await prisma.quiz.create({
    data: {
      courseId: course?.id || '00000000-0000-0000-0000-000000000001',
      title: 'Kiểm tra kiến thức cơ bản',
      description: 'Bài kiểm tra ngắn để đánh giá kiến thức cơ bản về lập trình.',
      timeLimitMinutes: 15,
      passingScore: 70,
      status: 'active',
      questions: {
        create: [
          {
            questionText: 'JavaScript là loại ngôn ngữ gì?',
            questionType: 'single_choice',
            options: [
              { value: 'A', label: 'Ngôn ngữ biên dịch' },
              { value: 'B', label: 'Ngôn ngữ thông dịch' },
              { value: 'C', label: 'Ngôn ngữ đánh dấu' },
              { value: 'D', label: 'Ngôn ngữ truy vấn' },
            ],
            correctAnswer: 'B',
            explanation: 'JavaScript là ngôn ngữ thông dịch (interpreted language), chạy trên trình duyệt hoặc Node.js.',
            points: 2,
            order: 1,
          },
          {
            questionText: 'Từ khóa nào dùng để khai báo hằng số trong JavaScript?',
            questionType: 'single_choice',
            options: [
              { value: 'A', label: 'var' },
              { value: 'B', label: 'let' },
              { value: 'C', label: 'const' },
              { value: 'D', label: 'static' },
            ],
            correctAnswer: 'C',
            explanation: 'Từ khóa "const" được dùng để khai báo hằng số trong JavaScript.',
            points: 2,
            order: 2,
          },
          {
            questionText: 'React được phát triển bởi công ty nào?',
            questionType: 'single_choice',
            options: [
              { value: 'A', label: 'Google' },
              { value: 'B', label: 'Microsoft' },
              { value: 'C', label: 'Facebook (Meta)' },
              { value: 'D', label: 'Apple' },
            ],
            correctAnswer: 'C',
            explanation: 'React được phát triển bởi Facebook (nay là Meta) và ra mắt lần đầu vào năm 2013.',
            points: 2,
            order: 3,
          },
          {
            questionText: 'HTTP status code 404 có nghĩa là gì?',
            questionType: 'single_choice',
            options: [
              { value: 'A', label: 'Internal Server Error' },
              { value: 'B', label: 'Not Found' },
              { value: 'C', label: 'Unauthorized' },
              { value: 'D', label: 'Forbidden' },
            ],
            correctAnswer: 'B',
            explanation: 'HTTP 404 có nghĩa là tài nguyên yêu cầu không được tìm thấy trên server.',
            points: 2,
            order: 4,
          },
          {
            questionText: 'Các lựa chọn nào sau đây là kiểu dữ liệu trong JavaScript?',
            questionType: 'multiple_choice',
            options: [
              { value: 'A', label: 'String' },
              { value: 'B', label: 'Number' },
              { value: 'C', label: 'Table' },
              { value: 'D', label: 'Boolean' },
              { value: 'E', label: 'Object' },
            ],
            correctAnswer: ['A', 'B', 'D', 'E'],
            explanation: 'JavaScript có các kiểu dữ liệu: String, Number, Boolean, Object, null, undefined, Symbol, BigInt. Table không phải là kiểu dữ liệu trong JS.',
            points: 2,
            order: 5,
          },
          {
            questionText: 'Node.js cho phép chạy JavaScript ở phía server.',
            questionType: 'true_false',
            options: [
              { value: true, label: 'Đúng' },
              { value: false, label: 'Sai' },
            ],
            correctAnswer: true,
            explanation: 'Node.js là môi trường chạy JavaScript phía server, dựa trên V8 engine của Chrome.',
            points: 1,
            order: 6,
          },
          {
            questionText: 'CSS là viết tắt của "Cascading Style Sheets".',
            questionType: 'true_false',
            options: [
              { value: true, label: 'Đúng' },
              { value: false, label: 'Sai' },
            ],
            correctAnswer: true,
            explanation: 'CSS là viết tắt của Cascading Style Sheets, ngôn ngữ dùng để định dạng giao diện web.',
            points: 1,
            order: 7,
          },
          {
            questionText: 'Phương thức nào dùng để thêm một phần tử vào cuối mảng trong JavaScript?',
            questionType: 'single_choice',
            options: [
              { value: 'A', label: 'push()' },
              { value: 'B', label: 'pop()' },
              { value: 'C', label: 'shift()' },
              { value: 'D', label: 'unshift()' },
            ],
            correctAnswer: 'A',
            explanation: 'push() thêm một phần tử vào cuối mảng. pop() xóa phần tử cuối, shift() xóa phần tử đầu, unshift() thêm phần tử vào đầu.',
            points: 2,
            order: 8,
          },
        ],
      },
    },
  });

  // Create a second quiz (no time limit)
  await prisma.quiz.create({
    data: {
      courseId: course?.id || '00000000-0000-0000-0000-000000000001',
      title: 'Bài tập cuối tuần',
      description: 'Bài tập tổng hợp cuối tuần, không giới hạn thời gian.',
      timeLimitMinutes: null,
      passingScore: 50,
      status: 'active',
      questions: {
        create: [
          {
            questionText: 'Git là hệ thống gì?',
            questionType: 'single_choice',
            options: [
              { value: 'A', label: 'Hệ thống quản lý cơ sở dữ liệu' },
              { value: 'B', label: 'Hệ thống quản lý phiên bản phân tán' },
              { value: 'C', label: 'Hệ thống quản lý package' },
              { value: 'D', label: 'Hệ thống quản lý server' },
            ],
            correctAnswer: 'B',
            explanation: 'Git là hệ thống quản lý phiên bản phân tán (DVCS), được tạo bởi Linus Torvalds.',
            points: 2,
            order: 1,
          },
          {
            questionText: 'REST API sử dụng phương thức HTTP nào để tạo mới tài nguyên?',
            questionType: 'single_choice',
            options: [
              { value: 'A', label: 'GET' },
              { value: 'B', label: 'POST' },
              { value: 'C', label: 'PUT' },
              { value: 'D', label: 'DELETE' },
            ],
            correctAnswer: 'B',
            explanation: 'POST được dùng để tạo mới tài nguyên. GET để đọc, PUT/PATCH để cập nhật, DELETE để xóa.',
            points: 2,
            order: 2,
          },
        ],
      },
    },
  });

  console.log('Quiz seed data created successfully!');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });