import { useState, useEffect } from 'react';
import { departmentRepository } from '../repositories/DepartmentRepository';
import { courseRepository } from '../repositories/CourseRepository';
import { Department, Course } from '../types/academic.types';

export function useDepartments(schoolId?: string) {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unmounted = false;
    async function loadData() {
      setLoading(true);
      try {
        const [depts, crs] = await Promise.all([
          departmentRepository.findAll(schoolId),
          courseRepository.findAll(schoolId),
        ]);
        if (!unmounted) {
          setDepartments(depts);
          setCourses(crs);
        }
      } catch (err) {
        console.error('Error loading departments and courses:', err);
      } finally {
        if (!unmounted) setLoading(false);
      }
    }

    loadData();
    return () => { unmounted = true; };
  }, [schoolId]);

  return { departments, courses, loading, departmentRepository, courseRepository };
}
