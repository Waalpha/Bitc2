# Security Specification - School Management System

## Data Invariants
1. Only Admins can modify global settings and school closure status.
2. Students can only read their own fee balances and notifications.
3. Teachers can mark attendance for their assigned classes.
4. Exams can only be created/updated by teachers or admins.
5. Submissions belong to students and are linked to exams. Once graded, only teachers/admins can update.

## The Dirty Dozen Payloads (Targeting Vulnerabilities)
1. **Identity Spoofing**: Creating a user profile with `role: 'admin'` as a new student.
2. **Settings Poisoning**: Updating the school title to a 2MB string.
3. **Ghost Closure**: Marking school as closed by a non-admin account.
4. **Fee Manipulation**: A student updating their own `balance` to 0.
5. **Orphaned Exam**: Creating an exam for a non-existent subject.
6. **Cross-Student Leak**: Student A reading notifications of Student B.
7. **Role Escalation**: Student A adding themselves to the `admins` collection (if it existed) or spoofing claim.
8. **Shadow Exam Data**: Adding extra fields like `isPerfectScore: true` to an exam.
9. **Negative Fee**: Setting `amount` to -10,000 in `fees`.
10. **ID Poisoning**: Using a 2KB string as a `docId` for a new submission.
11. **Future Attendance**: Posting attendance for the year 2099.
12. **Grade Injection**: Student updating their own `grade` field in `submissions`.
