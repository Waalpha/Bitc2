const fs = require('fs');

const users = JSON.parse(fs.readFileSync('data/users.json', 'utf8'));
const attendance = JSON.parse(fs.readFileSync('data/attendance.json', 'utf8'));

const sixtyDaysAgo = new Date();
sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
const sixtyDaysAgoStr = sixtyDaysAgo.toISOString().split('T')[0];

console.log('Sixty days ago:', sixtyDaysAgoStr);

const students = Object.entries(users)
  .map(([uid, data]) => ({ uid, ...data }))
  .filter(u => String(u.role).toLowerCase() === 'student');

console.log('Total students:', students.length);

const classAttendanceCount = {};
const studentPresenceCount = {};

Object.values(attendance).forEach(data => {
  const date = data.date;
  if (date && date >= sixtyDaysAgoStr) {
    const classId = data.classId;
    if (classId) {
      classAttendanceCount[classId] = (classAttendanceCount[classId] || 0) + 1;
    }
    const records = data.records || {};
    for (const [studentId, status] of Object.entries(records)) {
      if (status === 'present' || status === 'late' || status === 'excused') {
        studentPresenceCount[studentId] = (studentPresenceCount[studentId] || 0) + 1;
      }
    }
  }
});

const suspended = [];

students.forEach(student => {
  const sUid = student.uid;
  const classIds = student.classIds;
  const classId = student.classId;
  const cids = [];
  if (Array.isArray(classIds)) {
    cids.push(...classIds.map(String));
  } else if (classIds) {
    cids.push(String(classIds));
  }
  if (classId) {
    cids.push(String(classId));
  }
  const studentClassIds = cids.map(c => c.trim()).filter(Boolean);

  const hasAttendanceRecordedForStudentClasses = studentClassIds.some(cid => (classAttendanceCount[cid] || 0) > 0);
  const presenceCount = studentPresenceCount[sUid] || 0;

  if (hasAttendanceRecordedForStudentClasses && presenceCount === 0) {
    suspended.push(student);
  }
});

console.log('Suspended students:', suspended.map(s => s.name));
