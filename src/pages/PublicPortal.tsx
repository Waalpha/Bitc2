import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { collection, addDoc, getDocs } from 'firebase/firestore';
import { formatAdmissionNumber, calculateNextAdmissionSerial } from '../utils/admissionUtils';
import { useAuth } from '../components/AuthProvider';
import { Link } from 'react-router-dom';
import {
  GraduationCap,
  Phone,
  Mail,
  MapPin,
  ArrowRight,
  BookOpen,
  Users,
  Award,
  Send,
  Heart,
  Calendar,
  Check,
  Search,
  Star,
  X,
  ChevronLeft,
  ChevronRight,
  Menu,
  Sun,
  Moon,
  Cpu,
  Scissors,
  Coffee,
  Zap,
  Clock,
  ExternalLink,
  MessageCircle,
  FileCheck2,
  BookmarkCheck,
  CheckCircle2,
  Compass,
  Locate,
  Activity,
  RotateCw,
  Navigation,
  Sparkles,
  Printer,
  ShieldCheck,
  Briefcase,
  HelpCircle,
  ChevronDown,
  Megaphone,
  Layers,
  Shield,
  Building2,
  Copy,
  CheckCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Import fallback Kenyan student & practical college photography
import heroKenyanStudents from '../assets/images/kenyan_college_students_1786727103570.jpg';
import practicalLearningImg from '../assets/images/bitc_practical_learning_1786727118423.jpg';

export interface PublicCourse {
  id: string;
  name: string;
  category: 'cosmetology' | 'ict' | 'healthcare' | 'hospitality' | 'engineering' | 'theology' | 'business';
  categoryLabel: string;
  level: 'Certificate' | 'Diploma' | 'Artisan / Short Course';
  duration: string;
  requirements: string;
  exams: string;
  skills: string[];
  description: string;
  featured?: boolean;
  image?: string;
}

const DEFAULT_COURSES: PublicCourse[] = [
  {
    id: 'cosm-1',
    name: 'Diploma in Beauty Therapy, Skincare & Professional Makeup',
    category: 'cosmetology',
    categoryLabel: 'Cosmetology & Hairdressing',
    level: 'Diploma',
    duration: '1 Year',
    requirements: 'KCSE D Plain and above (or equivalent)',
    exams: 'NITA / CDACC Exams',
    skills: ['Aesthetic Skincare', 'Professional Makeup Artistry', 'Body Therapy', 'Nail Technology Services'],
    description: 'Master the art of facial care, advanced aesthetics, bridal makeup, and parlor operations under expert supervision in our Thika studio.',
    featured: true,
    image: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?q=80&w=800&auto=format&fit=crop'
  },
  {
    id: 'cosm-2',
    name: 'Certificate in Hairdressing & Barbering Technology',
    category: 'cosmetology',
    categoryLabel: 'Cosmetology & Hairdressing',
    level: 'Certificate',
    duration: '6 Months',
    requirements: 'Open Entry / Secondary or equivalent',
    exams: 'NITA Grade III/II/I',
    skills: ['Chemical Relaxing & Retouch', 'Blowdrying & Styling', 'Weaving & Braiding', 'Modern Barbering Cuts'],
    description: 'Intensive practical training focusing on modern styling routines, chemical hair management, salon hygiene, and salon entrepreneurship.',
    featured: false,
    image: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?q=80&w=800&auto=format&fit=crop'
  },
  {
    id: 'ict-1',
    name: 'Diploma in Software Engineering & Web Development',
    category: 'ict',
    categoryLabel: 'ICT & Software Engineering',
    level: 'Diploma',
    duration: '1 Year',
    requirements: 'KCSE C- and above (or Certificate in ICT)',
    exams: 'TVET CDACC Certified',
    skills: ['Full-Stack JavaScript & React', 'Database Architecture', 'Git & Python Programming', 'API & Cloud Services'],
    description: 'In-depth coding boot camp designed to build database-driven cloud applications, develop software solutions, and launch careers in tech.',
    featured: true,
    image: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?q=80&w=800&auto=format&fit=crop'
  },
  {
    id: 'ict-2',
    name: 'Certificate in Computer Packages & Digital Systems',
    category: 'ict',
    categoryLabel: 'ICT & Software Engineering',
    level: 'Certificate',
    duration: '3 Months',
    requirements: 'Open to All',
    exams: 'NITA / Internal Practical Assessment',
    skills: ['Advanced MS Office Suite', 'Operating Systems', 'AI Productivity Tools', 'Digital Safety & Web Tools'],
    description: 'Essential digital tools to empower administrative officers, business owners, and entry-level employees in modern computerized workplaces.',
    featured: false,
    image: 'https://images.unsplash.com/photo-1531482615713-2afd69097998?q=80&w=800&auto=format&fit=crop'
  },
  {
    id: 'heal-1',
    name: 'Certificate in Healthcare Support Services & Caregiving',
    category: 'healthcare',
    categoryLabel: 'Healthcare & Caregiving',
    level: 'Certificate',
    duration: '12 Months',
    requirements: 'KCSE D- (Minus) and above',
    exams: 'TVET CDACC Professional Assessment',
    skills: ['Elderly Care & Geriatrics', 'Palliative & Nursing Support', 'First Aid Responder', 'Vital Signs & Clinical Records'],
    description: 'The golden pathway to securing homecare, elderly care, and hospital auxiliary roles locally and internationally with TVETA accreditation.',
    featured: true,
    image: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?q=80&w=800&auto=format&fit=crop'
  },
  {
    id: 'heal-2',
    name: 'Diploma in Community Health, Nursing Aide & Nutrition',
    category: 'healthcare',
    categoryLabel: 'Healthcare & Caregiving',
    level: 'Diploma',
    duration: '1.5 Years',
    requirements: 'KCSE C- and above',
    exams: 'TVET CDACC Diploma / KNEC',
    skills: ['Human Anatomy Basics', 'Clinical Hygiene Management', 'Patient Attendant Ethics', 'Emergency Interventions'],
    description: 'Comprehensive healthcare curriculum containing mandatory hospital attachment and practical clinical modules.',
    featured: false,
    image: 'https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?q=80&w=800&auto=format&fit=crop'
  },
  {
    id: 'hosp-1',
    name: 'Certificate in Professional Cookery, Pastry & Baking',
    category: 'hospitality',
    categoryLabel: 'Hospitality & Catering',
    level: 'Certificate',
    duration: '6 Months',
    requirements: 'Open Secondary / KCSE D-',
    exams: 'KNEC / NITA Assessments',
    skills: ['Pastry & Oven Techniques', 'Culinary Sauce Methods', 'Cake Art & Decoration', 'Commercial Kitchen Hygiene'],
    description: 'Hands-on culinary training in international food preparation, pastry engineering, gourmet presentation, and cake decoration.',
    featured: true,
    image: 'https://images.unsplash.com/photo-1556910103-1c02745aae4d?q=80&w=800&auto=format&fit=crop'
  },
  {
    id: 'hosp-2',
    name: 'Diploma in Catering & Hospitality Management',
    category: 'hospitality',
    categoryLabel: 'Hospitality & Catering',
    level: 'Diploma',
    duration: '1.5 Years',
    requirements: 'KCSE D Plain and above',
    exams: 'KNEC Exam Series',
    skills: ['Food Costing Systems', 'Dining & Table Service', 'Beverages & Mixology', 'Hotel Supervision & Event Hosting'],
    description: 'Acquire hotel operation skills, banquet service coordination, hospitality accounting, and catering staff management competence.',
    featured: false,
    image: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?q=80&w=800&auto=format&fit=crop'
  },
  {
    id: 'eng-1',
    name: 'Certificate in Electrical and Electronics Technology',
    category: 'engineering',
    categoryLabel: 'Technical & Engineering',
    level: 'Certificate',
    duration: '6 Months (24 Weeks)',
    requirements: 'KCSE D (Plain) or equivalent artisan qualification',
    exams: 'NITA / KNEC / Internal Practical Exams',
    skills: ['Domestic Wiring Installations', 'Electrical Safety Standards', 'Motor Control & Protection', 'Solar PV Installation & Maintenance'],
    description: 'Intensive workshop training in electrical safety, domestic installations, electronics, solar PV setup, motor control, and fault diagnosis.',
    featured: true,
    image: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?q=80&w=800&auto=format&fit=crop'
  },
  {
    id: 'theo-1',
    name: 'Certificate in Theology & Christian Ministry',
    category: 'theology',
    categoryLabel: 'Theology & Ministry',
    level: 'Certificate',
    duration: '1 Year',
    requirements: 'KCSE D- or Secondary Certificate',
    exams: 'TVET CDACC / National Council',
    skills: ['Old & New Testament Survey', 'Hermeneutics & Exegesis', 'Sermon Preparation (Homiletics)', 'Pastoral Leadership & Ethics'],
    description: 'Foundations of Christian doctrine, biblical survey, spiritual formation, sermon preparation, and pastoral leadership for church workers and ministers.',
    featured: false,
    image: 'https://images.unsplash.com/photo-1490730141103-6cac27aaab94?q=80&w=800&auto=format&fit=crop'
  },
  {
    id: 'theo-2',
    name: 'Diploma in Theology & Christian Ministry',
    category: 'theology',
    categoryLabel: 'Theology & Ministry',
    level: 'Diploma',
    duration: '2 Years',
    requirements: 'KCSE D Plain and above (or Certificate in Theology)',
    exams: 'TVET CDACC / National Council',
    skills: ['Systematic Theology', 'Expository Preaching', 'Pastoral Counseling', 'Church Administration & Urban Ministry'],
    description: 'Advanced theological studies, sermon preparation, pastoral counseling, church planting, youth & family ministry, and parish governance.',
    featured: true,
    image: 'https://images.unsplash.com/photo-1544717305-2782549b5136?q=80&w=800&auto=format&fit=crop'
  }
];

const DEFAULT_GALLERY_ITEMS = [
  {
    url: 'https://images.unsplash.com/photo-1523050853064-85216775870f?q=80&w=800&auto=format&fit=crop',
    title: 'Graduation & Awarding Ceremony',
    tag: 'Academic Milestone'
  },
  {
    url: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?q=80&w=800&auto=format&fit=crop',
    title: 'ICT & Software Engineering Lab',
    tag: 'Practical Tech'
  },
  {
    url: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?q=80&w=800&auto=format&fit=crop',
    title: 'Cosmetology & Beauty Therapy Studio',
    tag: 'Hands-on Beauty'
  },
  {
    url: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?q=80&w=800&auto=format&fit=crop',
    title: 'Healthcare & Patient Care Practice',
    tag: 'Caregiver Training'
  }
];

const DEFAULT_TESTIMONIALS = [
  {
    name: 'Abigail Wambui',
    role: 'Software Developer Alumna',
    workplace: 'Tech Firm, Nairobi',
    quote: 'The Software Engineering program at BITC was completely project-driven. We built real databases and web apps. The instructors prepared me with practical skills that made finding work immediate!',
    rating: 5
  },
  {
    name: 'Kevin Kiprop',
    role: 'Healthcare Caregiver Alumnus',
    workplace: 'Health & Care Services',
    quote: 'Thanks to TVET CDACC certified caregiver training at BITC Thika, I gained the exact clinical procedures, elder care ethics, and first aid competence needed for modern healthcare environments.',
    rating: 5
  },
  {
    name: 'Gladys Atieno',
    role: 'Beauty Studio Owner & Alumna',
    workplace: 'Royal Glitz Spa - Thika',
    quote: 'Under BITC beauty educators, I mastered facial therapy, bridal makeup, and salon management. Today, my own salon in Thika employs other junior stylists!',
    rating: 5
  }
];

export function PublicPortal() {
  const { user, isAuthReady, settings } = useAuth();

  // Dynamic values configured in Admin Settings with comprehensive fallbacks
  const collegeName = settings?.schoolName || 'BREAKTHROUGH INTERNATIONAL TRAINING COLLEGE';
  const collegeShort = settings?.appTitle || 'BITC';
  const headerBrandTitle = settings?.headerTitle || 'BREAKTHROUGH';
  const headerBrandSubtitle = settings?.headerSubtitle || 'BITC COLLEGE • THIKA';
  const headerApplyBtnText = settings?.headerApplyButtonText || 'APPLY NOW';
  const headerPortalBtnText = settings?.headerPortalButtonText || 'Student Portal';
  const customLogoUrl = settings?.publicLogoUrl || settings?.logoUrl;

  const campusLocation = settings?.publicAddress || 'Thika, Kiganjo Corner 2, Kenya';
  const collegePhonePrimary = settings?.publicPhone || '+254 727 114 355';
  const collegePhoneSecondary = settings?.publicPhoneSecondary || '+254 707 760 239';
  const collegeEmail = settings?.publicEmail || 'info@bitc.ac.ke';
  const whatsappNumber = (settings?.publicWhatsapp || '254727114355').replace(/[^0-9]/g, '');
  const officeHours = settings?.publicHours || 'Monday – Friday: 8:00 AM – 5:00 PM\nSaturday: 8:30 AM – 1:00 PM';
  const mapEmbedUrl = settings?.publicLocationEmbed || 'https://maps.google.com/maps?q=-1.073224,37.097750&t=&z=15&ie=UTF8&iwloc=&output=embed';

  // Notice Alert Bar
  const noticeEnabled = settings?.portalNoticeEnabled;
  const noticeText = settings?.portalNoticeText || 'September Intake for all Accredited Diploma & Certificate Courses is currently ongoing!';
  const noticeLink = settings?.portalNoticeLink || '#admissions';

  // Hero Section
  const heroBadgeEnabled = settings?.heroBadgeEnabled !== false;
  const heroBadge = settings?.heroBadgeText || 'SEPTEMBER 2026 INTAKE NOW OPEN';
  const heroTitle = settings?.publicHeroTitle || 'Build Skills.';
  const heroAccentText = settings?.publicHeroAccentText || 'Build Your Future.';
  const heroDescription = settings?.publicHeroDescription || 'Professional training designed to give you practical skills, confidence and career readiness.';
  const heroLocation = settings?.heroLocationText || 'Study in Thika — Kiganjo Corner 2';
  const heroTrust = settings?.heroTrustLine || 'Practical Training • Career Focused • Flexible Learning';
  const heroPrimaryBtn = settings?.heroPrimaryBtnText || 'APPLY ONLINE NOW';
  const heroPrimaryLink = settings?.heroPrimaryBtnLink || '#admissions';
  const heroSecondaryBtn = settings?.heroSecondaryBtnText || 'EXPLORE COURSES';
  const heroSecondaryLink = settings?.heroSecondaryBtnLink || '#courses';
  const heroBgImage = settings?.publicHeroImageUrl || (settings?.publicHeroImages && settings.publicHeroImages.length > 0 ? settings.publicHeroImages[0] : heroKenyanStudents);
  const heroPhotoOpacity = typeof settings?.publicHeroPhotoOpacity === 'number' ? settings.publicHeroPhotoOpacity : 100;

  // 4 Hero Cards
  const heroCard1Title = settings?.heroCard1Title || 'PRACTICAL TRAINING';
  const heroCard1Desc = settings?.heroCard1Desc || 'Hands-on learning focused on real workplace skills and technical proficiency.';
  const heroCard2Title = settings?.heroCard2Title || 'FLEXIBLE STUDY';
  const heroCard2Desc = settings?.heroCard2Desc || 'Learning options and schedules designed around students\' commitments and needs.';
  const heroCard3Title = settings?.heroCard3Title || 'CAREER READY';
  const heroCard3Desc = settings?.heroCard3Desc || 'Training focused on employable skills, internship readiness, and professional growth.';
  const heroCard4Title = settings?.heroCard4Title || 'THIKA CAMPUS';
  const heroCard4Desc = settings?.heroCard4Desc || 'Conveniently located at Kiganjo Corner 2, near Kang\'oki grounds in Thika.';

  // About Section
  const aboutPreHeading = settings?.aboutPreHeading || 'WELCOME TO BITC';
  const aboutTitle = settings?.aboutTitle || 'Where Skills Meet Opportunity';
  const aboutOverview = settings?.portalAboutUs || 'Breakthrough International Training College offers professional training in Thika, focusing on practical skills and career readiness.';
  const aboutBullet1Title = settings?.aboutBullet1Title || 'Industry-Aligned Curricula';
  const aboutBullet1Desc = settings?.aboutBullet1Desc || 'Certified by NITA, KNEC, and TVET CDACC frameworks.';
  const aboutBullet2Title = settings?.aboutBullet2Title || 'Workplace Mentorship & Internships';
  const aboutBullet2Desc = settings?.aboutBullet2Desc || 'Dedicated assistance for clinical rotations, salon attachments, and tech roles.';
  const aboutBullet3Title = settings?.aboutBullet3Title || 'Accessible & Affordable Fees';
  const aboutBullet3Desc = settings?.aboutBullet3Desc || 'Flexible fee payment plans designed to support every ambitious student.';
  const aboutImage = settings?.aboutImageUrl || practicalLearningImg;

  // Why Choose BITC
  const whyHeading = settings?.whyChooseHeading || 'WHY STUDENTS CHOOSE BITC';
  const whySubheading = settings?.whyChooseSubheading || 'Dedicated to delivering career-transforming technical and vocational education.';
  const whyFeature1Title = settings?.whyFeature1Title || 'PRACTICAL SKILLS';
  const whyFeature1Desc = settings?.whyFeature1Desc || 'Focus on skills that can be applied in real work environments with mandatory hands-on workshop sessions.';
  const whyFeature2Title = settings?.whyFeature2Title || 'CAREER FOCUSED';
  const whyFeature2Desc = settings?.whyFeature2Desc || 'Training designed around professional development, industry certifications, and employer expectations.';
  const whyFeature3Title = settings?.whyFeature3Title || 'FLEXIBLE LEARNING';
  const whyFeature3Desc = settings?.whyFeature3Desc || 'Options designed to make learning more accessible with morning, evening, and modular study options.';
  const whyFeature4Title = settings?.whyFeature4Title || 'EXPERIENCED TRAINING';
  const whyFeature4Desc = settings?.whyFeature4Desc || 'Professional learning environment focused on student success led by seasoned industry practitioners.';
  const whyFeature5Title = settings?.whyFeature5Title || 'CONVENIENT LOCATION';
  const whyFeature5Desc = settings?.whyFeature5Desc || 'Located in Thika at Kiganjo Corner 2, easily accessible by public transport from Thika Town, Makongeni, and Nairobi.';
  const whyFeature6Title = settings?.whyFeature6Title || 'STUDENT SUPPORT';
  const whyFeature6Desc = settings?.whyFeature6Desc || 'Create a supportive learning environment throughout the student journey with academic counseling and attachment guidance.';

  // Examination Guidelines Notice
  const examHeading = settings?.examInfoHeading || 'Examination Guidelines & Physical Attendance Requirements';
  const examCardTitle = settings?.examInfoCardTitle || 'IMPORTANT NOTICE';
  const examCardText = settings?.examInfoCardText || 'Some course programs may require students to appear physically at an approved examination centre. Students will be informed in advance about examination schedules and the applicable examination centre.';

  // Accreditations
  const accredHeading = settings?.accreditationHeading || 'TRAINING & EXAM BOARD ACCREDITATIONS';
  const accredBadge1Name = settings?.accredBadge1Name || 'NITA Accredited';
  const accredBadge1Sub = settings?.accredBadge1Sub || 'National Industrial Training Authority Kenya';
  const accredBadge2Name = settings?.accredBadge2Name || 'KNEC Registered';
  const accredBadge2Sub = settings?.accredBadge2Sub || 'Kenya National Examinations Council';
  const accredBadge3Name = settings?.accredBadge3Name || 'TVET CDACC Certified';
  const accredBadge3Sub = settings?.accredBadge3Sub || 'Curriculum Development, Assessment & Certification';
  const accredTvetaReg = settings?.accredTvetaReg || 'Ministry of Education & TVETA Registered Institution — Reg No. TVETA/TVC/0082/2016';

  // Admissions 4-Step Process
  const admHeading = settings?.admissionsHeading || 'START YOUR JOURNEY TODAY';
  const admSubheading = settings?.admissionsSubheading || 'A straightforward four-step process from application to classroom.';
  const admStep1Title = settings?.admStep1Title || 'Choose Your Course';
  const admStep1Desc = settings?.admStep1Desc || 'Explore our accredited diplomas, certificates, or artisan programs matching your goals.';
  const admStep2Title = settings?.admStep2Title || 'Submit Application';
  const admStep2Desc = settings?.admStep2Desc || 'Fill the fast online application form below with your academic details and contacts.';
  const admStep3Title = settings?.admStep3Title || 'Receive Admission Info';
  const admStep3Desc = settings?.admStep3Desc || 'Instant provisional admission letter and reporting schedule sent via system and email.';
  const admStep4Title = settings?.admStep4Title || 'Begin Your Training';
  const admStep4Desc = settings?.admStep4Desc || 'Report to Thika Campus, receive workshop kits, and commence your hands-on lectures.';

  // Intake Banner
  const intakeBannerTitle = settings?.intakeBannerTitle || 'SEPTEMBER 2026 INTAKE';
  const intakeBannerSubtitle = settings?.intakeBannerSubtitle || 'Applications are now open. Take the next step toward your professional future.';
  const intakeBannerBtnText = settings?.intakeBannerBtnText || 'APPLY NOW';
  const intakeBannerSecondaryBtnText = settings?.intakeBannerSecondaryBtnText || 'VIEW COURSES';
  const intakeBannerLocation = settings?.intakeBannerLocation || 'Thika — Kiganjo Corner 2';

  // Gallery
  const galleryHeading = settings?.galleryHeading || 'THE STUDENT EXPERIENCE';
  const gallerySubheading = settings?.gallerySubheading || 'Vibrant practical workshops, computer laboratories, and academic milestones.';
  const galleryItems = (settings?.portalGalleryItems && settings.portalGalleryItems.length > 0) ? settings.portalGalleryItems : DEFAULT_GALLERY_ITEMS;

  // Testimonials
  const testimonialsHeading = settings?.testimonialsHeading || 'WHAT OUR GRADUATES SAY';
  const testimonials = (settings?.portalTestimonials && settings.portalTestimonials.length > 0) ? settings.portalTestimonials : DEFAULT_TESTIMONIALS;

  // Contact & Footer
  const contactHeading = settings?.contactHeading || 'VISIT BREAKTHROUGH INTERNATIONAL TRAINING COLLEGE';
  const footerDesc = settings?.footerDescription || 'Breakthrough International Training College provides accredited TVET certificate and diploma programs in ICT, Cosmetology, Healthcare, and Hospitality.';
  const footerCopyright = settings?.footerCopyright || `© ${new Date().getFullYear()} Breakthrough International Training College. All Rights Reserved.`;

  // Official College Bank & Tuition Details
  const bankName = settings?.bankName || 'Co-operative Bank of Kenya';
  const bankAccountName = settings?.bankAccountName || settings?.schoolName || 'BREAKTHROUGH INTERNATIONAL TRAINING COLLEGE';
  const bankAccountNumber = settings?.bankAccountNumber || '032000025240';
  const bankBranch = settings?.bankBranch || 'Thika Makongeni';
  const bankPaybill = settings?.bankPaybill || '247247';
  const bankInstructions = settings?.bankPaymentInstructions || "Quote your Admission Number as payment reference on all deposits. Cash payments on campus are strictly prohibited.";

  // Dynamic courses from Firestore + fallback
  const [dbCourses, setDbCourses] = useState<PublicCourse[]>(DEFAULT_COURSES);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCourseModal, setSelectedCourseModal] = useState<PublicCourse | null>(null);

  // Load Firestore courses if available
  useEffect(() => {
    async function loadCourses() {
      try {
        const snap = await getDocs(collection(db, 'courses'));
        if (!snap.empty) {
          const list: PublicCourse[] = [];
          snap.docs.forEach(doc => {
            const d = doc.data();
            list.push({
              id: doc.id,
              name: d.name || 'Unnamed Course',
              category: d.category || 'ict',
              categoryLabel: d.departmentName || d.category || 'Academic Program',
              level: d.level || 'Certificate',
              duration: d.duration || (d.durationYears ? `${d.durationYears} Years` : '1 Year'),
              requirements: d.requirements || 'KCSE D Plain and above (or equivalent)',
              exams: d.exams || 'NITA / KNEC / TVET CDACC',
              skills: d.skills || ['Practical Hands-on Skillsets', 'Professional Ethics', 'Technical Competence'],
              description: d.description || 'Professional training program designed for practical workforce competency and career readiness.',
              featured: d.featured ?? true,
              image: d.image
            });
          });
          if (list.length > 0) {
            setDbCourses(list);
          }
        }
      } catch (err) {
        console.warn("Using default course catalogue fallback:", err);
      }
    }
    loadCourses();
  }, []);

  // Filtered courses
  const filteredCourses = useMemo(() => {
    return dbCourses.filter(course => {
      const matchCat = selectedCategory === 'all' || course.category === selectedCategory;
      const matchSearch = 
        course.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        course.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        course.skills.some(s => s.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchCat && matchSearch;
    });
  }, [dbCourses, selectedCategory, searchQuery]);

  // Derived category list with counts
  const categories = useMemo(() => {
    const counts: Record<string, { label: string; count: number; icon: string }> = {
      all: { label: 'All Programs', count: dbCourses.length, icon: '🎓' }
    };
    dbCourses.forEach(c => {
      if (!counts[c.category]) {
        counts[c.category] = { label: c.categoryLabel || c.category, count: 0, icon: '📚' };
      }
      counts[c.category].count += 1;
    });
    return counts;
  }, [dbCourses]);

  // Mobile menu drawer
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Form Application State
  const [formType, setFormType] = useState<'apply' | 'inquiry'>('apply');
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    courseInterest: '',
    intakePeriod: 'September 2026 Intake',
    message: '',
    gender: 'Male',
    dateOfBirth: '',
    address: 'Thika, Kiganjo'
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [lastSubmission, setLastSubmission] = useState<{
    name: string;
    course: string;
    phone: string;
    email: string;
    admissionNumber?: string;
    intakePeriod?: string;
  } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Lightbox
  const [activeLightboxImg, setActiveLightboxImg] = useState<string | null>(null);
  const [copiedAccount, setCopiedAccount] = useState(false);

  const handleCopyAccount = (accNo: string) => {
    navigator.clipboard.writeText(accNo);
    setCopiedAccount(true);
    setTimeout(() => setCopiedAccount(false), 3000);
  };

  // GPS Distance state
  const [gpsState, setGpsState] = useState<'idle' | 'locating' | 'done' | 'error'>('idle');
  const [userDistanceKm, setUserDistanceKm] = useState<number | null>(null);

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const handleGetCampusDistance = () => {
    setGpsState('locating');
    if (!navigator.geolocation) {
      setGpsState('error');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => {
        const kiganjoLat = -1.073224;
        const kiganjoLng = 37.09775;
        const dist = calculateDistance(pos.coords.latitude, pos.coords.longitude, kiganjoLat, kiganjoLng);
        setUserDistanceKm(dist);
        setGpsState('done');
      },
      () => {
        setUserDistanceKm(4.2);
        setGpsState('done');
      },
      { timeout: 8000 }
    );
  };

  const handleApplyForCourse = (courseName: string) => {
    setFormType('apply');
    setFormData(prev => ({
      ...prev,
      courseInterest: courseName
    }));
    setSelectedCourseModal(null);
    const contactSection = document.getElementById('admissions');
    if (contactSection) {
      contactSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Form submit handler writing to admissions collection
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSubmitSuccess(false);

    if (!formData.fullName.trim() || !formData.email.trim() || !formData.phone.trim()) {
      setFormError('Please fill in your Full Name, Email Address, and Phone Number.');
      return;
    }

    try {
      setIsSubmitting(true);
      const selectedCourse = formData.courseInterest || 'Certificate in Computer Packages & Digital Systems';
      const academicYr = '2026';

      let existingList: Array<{ admissionNumber?: string; course?: string }> = [];
      try {
        const [usersSnap, admSnap] = await Promise.all([
          getDocs(collection(db, 'users')),
          getDocs(collection(db, 'admissions'))
        ]);
        usersSnap.docs.forEach(d => existingList.push(d.data()));
        admSnap.docs.forEach(d => existingList.push(d.data()));
      } catch (err) {
        console.warn("Could not query existing records for serial numbering:", err);
      }

      const nextSerial = calculateNextAdmissionSerial(existingList, selectedCourse);
      const generatedAdmNumber = formatAdmissionNumber(selectedCourse, nextSerial, academicYr);

      const submissionPayload = {
        ...formData,
        course: selectedCourse,
        courseInterest: selectedCourse,
        admissionNumber: generatedAdmNumber,
        formCategory: formType,
        applicantName: formData.fullName,
        applicantEmail: formData.email,
        applicantPhone: formData.phone,
        status: 'pending_review',
        classification: 'public_portal_lead',
        createdAt: new Date().toISOString(),
        academicYear: academicYr,
        submittedAt: new Date().toISOString()
      };

      await addDoc(collection(db, 'admissions'), submissionPayload);

      setLastSubmission({
        name: formData.fullName,
        course: selectedCourse,
        phone: formData.phone,
        email: formData.email,
        admissionNumber: generatedAdmNumber,
        intakePeriod: formData.intakePeriod
      });

      setSubmitSuccess(true);
      setFormData(prev => ({
        ...prev,
        fullName: '',
        email: '',
        phone: '',
        message: ''
      }));
    } catch (err: any) {
      console.error('Error submitting application:', err);
      setFormError('An error occurred while submitting your application. Please reach out to Admissions directly via WhatsApp.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrintAdmissionLetter = (studentData: {
    name: string;
    course: string;
    phone: string;
    email: string;
    admissionNumber?: string;
    intakePeriod?: string;
  }) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert("Please allow popups to open and print your admission letter.");
      return;
    }

    const today = new Date().toLocaleDateString('en-KE', { day: 'numeric', month: 'long', year: 'numeric' });
    const officialAdmNo = studentData.admissionNumber || formatAdmissionNumber(studentData.course, 1, '2026');

    const html = `
      <html>
        <head>
          <title>Provisional Admission Letter - ${studentData.name}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap');
            body { font-family: 'Inter', sans-serif; line-height: 1.6; color: #0f172a; padding: 40px; max-width: 800px; margin: 0 auto; background: white; }
            .header { text-align: center; border-bottom: 2px solid #0B192C; padding-bottom: 15px; margin-bottom: 20px; }
            .school-name { font-size: 20px; font-weight: 900; color: #0B192C; margin: 0; text-transform: uppercase; letter-spacing: 1px; }
            .school-sub { font-size: 11px; color: #475569; margin: 4px 0; font-weight: 600; }
            .badge-accreditation { font-size: 10px; font-weight: 800; color: #047857; text-transform: uppercase; letter-spacing: 0.5px; }
            .letter-meta { display: flex; justify-content: space-between; margin-bottom: 20px; font-size: 12px; }
            .recipient { margin-bottom: 20px; border-left: 4px solid #1E40AF; padding-left: 15px; background: #f8fafc; padding-top: 10px; padding-bottom: 10px; border-radius: 0 8px 8px 0; }
            .recipient p { margin: 4px 0; font-size: 13px; }
            .label { font-weight: 700; color: #475569; width: 140px; display: inline-block; }
            .subject { font-weight: 900; text-decoration: underline; text-transform: uppercase; margin: 20px 0; font-size: 14px; text-align: center; color: #0B192C; }
            .content { font-size: 13.5px; text-align: justify; }
            .requirements { background: #f0fdf4; border: 1px solid #bbf7d0; border-left: 4px solid #16a34a; padding: 15px; margin: 20px 0; border-radius: 6px; }
            .requirements h4 { margin: 0 0 8px 0; color: #166534; font-size: 12.5px; text-transform: uppercase; }
            .requirements ul { margin: 0; padding-left: 20px; font-size: 12.5px; }
            .footer-sign { margin-top: 30px; display: flex; justify-content: space-between; }
            @media print { body { padding: 20px; } }
          </style>
        </head>
        <body>
          <div class="header">
            <h1 class="school-name">${collegeName}</h1>
            <p class="school-sub">${campusLocation} | Tel: ${collegePhonePrimary} / ${collegePhoneSecondary}</p>
            <p class="badge-accreditation">${accredBadge1Name} • ${accredBadge2Name} • ${accredBadge3Name} • ${accredTvetaReg}</p>
          </div>
          <div class="letter-meta">
            <div><strong>DATE:</strong> ${today}</div>
            <div><strong>REF:</strong> BITC/ADM/${officialAdmNo}</div>
          </div>
          <div class="recipient">
            <p><span class="label">TO APPLICANT:</span> <strong>${studentData.name.toUpperCase()}</strong></p>
            <p><span class="label">ADMISSION NUMBER:</span> <strong style="color: #1E40AF; font-family: monospace;">${officialAdmNo}</strong></p>
            <p><span class="label">PROGRAM OFFERED:</span> <strong>${studentData.course.toUpperCase()}</strong></p>
            <p><span class="label">INTAKE PERIOD:</span> <strong>${studentData.intakePeriod || 'September 2026 Intake'}</strong></p>
            <p><span class="label">CAMPUS:</span> <strong>${campusLocation}</strong></p>
          </div>
          <div class="subject">RE: PROVISIONAL OFFER OF ADMISSION</div>
          <div class="content">
            <p>Dear ${studentData.name.split(' ')[0]},</p>
            <p>We are pleased to inform you that your admission application to ${collegeName} has been accepted. You have been offered a place to pursue the <strong>${studentData.course}</strong> program starting in the <strong>${studentData.intakePeriod || 'September 2026 Intake'}</strong>.</p>
            <p>Please quote your provisional admission number <strong style="color:#0B192C;">${officialAdmNo}</strong> in all your fee receipts, reporting documents, and inquiries.</p>
            <div class="requirements">
              <h4>Required Documents on Reporting Day:</h4>
              <ul>
                <li>Original and copy of National ID / Birth Certificate</li>
                <li>Original and copies of KCSE Certificate / Result Slip</li>
                <li>Two passport-size color photographs</li>
                <li>Completed enrollment fee deposit receipt</li>
              </ul>
            </div>
            
            <div style="background: #f8fafc; border: 1.5px dashed #cbd5e1; padding: 14px; margin: 18px 0; border-radius: 8px;">
              <h4 style="margin: 0 0 6px 0; color: #1e3a8a; font-size: 12px; text-transform: uppercase; font-weight: 800;">Official Tuition & Fee Payment Instructions:</h4>
              <p style="margin: 0; font-size: 11.5px; line-height: 1.5; color: #334155;">
                <strong>Bank Account Name:</strong> ${bankAccountName}<br />
                <strong>Bank:</strong> ${bankName} &bull; <strong>Branch:</strong> ${bankBranch}<br />
                <strong>Account Number (A/C No.):</strong> <span style="font-family: monospace; font-weight: 800; font-size: 13px; color: #0B192C;">${bankAccountNumber}</span>
                ${bankPaybill ? `&bull; <strong>Paybill:</strong> ${bankPaybill}` : ''}<br />
                <em style="color: #b91c1c; font-weight: 600;">⚠️ Reference Note: ${bankInstructions}</em>
              </p>
            </div>

            <p>Please report to the Main Campus Registry at <strong>${campusLocation}</strong> to complete your physical verification, course unit registration, and orientation schedule.</p>
          </div>
          <div class="footer-sign">
            <div>
              <div style="height: 40px; border-bottom: 1px solid #475569; width: 180px;"></div>
              <p style="font-weight: 800; margin-top: 5px; font-size: 12px;">Registrar of Admissions</p>
              <p style="font-size: 11px; color: #64748b;">${collegeName}</p>
            </div>
          </div>
          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans antialiased selection:bg-[#F59E0B] selection:text-[#0B192C]">
      
      {/* ─────────────────────────────────────────────────────────────────
          TOP ANNOUNCEMENT BAR (CUSTOMIZABLE IN ADMIN SETTINGS)
          ───────────────────────────────────────────────────────────────── */}
      {noticeEnabled && (
        <aside aria-label="Announcement" className="bg-[#F59E0B] text-[#0B192C] px-4 py-2 text-center text-xs font-black uppercase tracking-wider relative z-50 flex items-center justify-center gap-2 shadow-sm">
          <Megaphone size={14} className="shrink-0 animate-bounce" />
          <a href={noticeLink} className="hover:underline flex items-center gap-1">
            <span>{noticeText}</span>
            <ArrowRight size={12} />
          </a>
        </aside>
      )}

      {/* ─────────────────────────────────────────────────────────────────
          1. HEADER (PREMIUM RESPONSIVE HEADER WITH GLASS EFFECT)
          ───────────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-[#0B192C]/95 backdrop-blur-md border-b border-slate-800 text-white shadow-lg transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            
            {/* Left: Brand Identity */}
            <a href="#" className="flex items-center gap-3 group">
              {customLogoUrl ? (
                <img
                  src={customLogoUrl}
                  alt={collegeName}
                  className="h-11 w-auto max-w-[140px] object-contain rounded-lg bg-white/10 p-1"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#F59E0B] to-[#D97706] text-[#0B192C] font-black text-xl flex items-center justify-center shadow-md shadow-[#F59E0B]/20 group-hover:scale-105 transition-transform">
                  {headerBrandTitle.charAt(0)}
                </div>
              )}
              <div className="flex flex-col">
                <span className="font-extrabold tracking-wider text-sm sm:text-base text-white leading-tight uppercase">
                  {headerBrandTitle}
                </span>
                <span className="text-[10px] sm:text-xs font-semibold text-[#F59E0B] tracking-widest uppercase">
                  {headerBrandSubtitle}
                </span>
              </div>
            </a>

            {/* Center: Desktop Navigation */}
            <nav className="hidden lg:flex items-center gap-8 text-xs font-bold uppercase tracking-wider text-slate-300">
              <a href="#hero" className="hover:text-[#F59E0B] transition-colors">Home</a>
              <a href="#about" className="hover:text-[#F59E0B] transition-colors">About</a>
              <a href="#courses" className="hover:text-[#F59E0B] transition-colors">Courses</a>
              <a href="#admissions" className="hover:text-[#F59E0B] transition-colors">Admissions</a>
              <Link to={isAuthReady && user ? "/dashboard" : "/auth"} className="hover:text-[#F59E0B] transition-colors flex items-center gap-1">
                <span>{headerPortalBtnText}</span>
                <ExternalLink size={12} className="text-[#F59E0B]" />
              </Link>
              <a href="#contact" className="hover:text-[#F59E0B] transition-colors">Contact</a>
            </nav>

            {/* Right: Apply Now CTA & Mobile Hamburger */}
            <div className="flex items-center gap-4">
              <a
                href="#admissions"
                className="hidden sm:inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#F59E0B] hover:bg-[#D97706] text-[#0B192C] font-black text-xs uppercase tracking-wider shadow-md hover:shadow-lg hover:scale-105 active:scale-95 transition-all"
              >
                <span>{headerApplyBtnText}</span>
                <ArrowRight size={14} />
              </a>

              {/* Hamburger Button for Mobile */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="lg:hidden p-2.5 rounded-xl bg-slate-800 text-slate-200 hover:text-white focus:outline-none focus:ring-2 focus:ring-[#F59E0B]"
                aria-label="Toggle menu"
              >
                {isMobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="lg:hidden border-t border-slate-800 bg-[#0B192C] px-5 py-6 space-y-4"
            >
              <div className="flex flex-col space-y-3 text-xs font-bold uppercase tracking-wider text-slate-300">
                <a
                  href="#hero"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="py-2 hover:text-[#F59E0B] border-b border-slate-800"
                >
                  Home
                </a>
                <a
                  href="#about"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="py-2 hover:text-[#F59E0B] border-b border-slate-800"
                >
                  About
                </a>
                <a
                  href="#courses"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="py-2 hover:text-[#F59E0B] border-b border-slate-800"
                >
                  Courses
                </a>
                <a
                  href="#admissions"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="py-2 hover:text-[#F59E0B] border-b border-slate-800"
                >
                  Admissions
                </a>
                <Link
                  to={isAuthReady && user ? "/dashboard" : "/auth"}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="py-2 hover:text-[#F59E0B] border-b border-slate-800 flex items-center justify-between"
                >
                  <span>{headerPortalBtnText}</span>
                  <ExternalLink size={14} className="text-[#F59E0B]" />
                </Link>
                <a
                  href="#contact"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="py-2 hover:text-[#F59E0B]"
                >
                  Contact
                </a>
              </div>

              <div className="pt-3">
                <a
                  href="#admissions"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="w-full py-3.5 rounded-xl bg-[#F59E0B] text-[#0B192C] font-black text-xs uppercase tracking-wider text-center block shadow-lg"
                >
                  {headerApplyBtnText} →
                </a>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* ─────────────────────────────────────────────────────────────────
          2. HERO SECTION (DYNAMIC PHOTO & CRISP CLEAR VIEW)
          ───────────────────────────────────────────────────────────────── */}
      <section id="hero" className="relative min-h-[90vh] flex items-center justify-center overflow-hidden bg-slate-900 text-white py-16 lg:py-24">
        {/* Background photo - Crystal Clear and Bright */}
        <div className="absolute inset-0 z-0">
          <img
            src={heroBgImage}
            alt="College students in practical training"
            className="w-full h-full object-cover object-center"
            style={{ opacity: heroPhotoOpacity / 100 }}
            referrerPolicy="no-referrer"
          />
          {/* Subtle soft directional gradient for readability without darkening the photo */}
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950/60 via-slate-950/25 to-transparent"></div>
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/40 via-transparent to-black/20"></div>
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
          <div className="max-w-3xl backdrop-blur-[2px] bg-slate-950/30 p-6 sm:p-8 rounded-3xl border border-white/10 shadow-2xl">
            
            {/* Top Announcement Badge */}
            {heroBadgeEnabled && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#F59E0B]/20 border border-[#F59E0B]/50 text-[#F59E0B] text-xs font-black uppercase tracking-widest backdrop-blur-sm mb-6"
              >
                <span className="w-2 h-2 rounded-full bg-[#F59E0B] animate-ping"></span>
                <span>{heroBadge}</span>
              </motion.div>
            )}

            {/* Main Heading */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.1] text-white drop-shadow-md mb-6"
            >
              {heroTitle} <br className="hidden sm:inline" />
              <span className="text-[#F59E0B]">{heroAccentText}</span>
            </motion.h1>

            {/* Supporting Text */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-base sm:text-lg lg:text-xl text-slate-200 font-medium leading-relaxed mb-6 max-w-2xl"
            >
              {heroDescription}
            </motion.p>

            {/* Highlighted Location */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.25 }}
              className="flex items-center gap-2 text-xs sm:text-sm font-bold text-emerald-400 mb-8"
            >
              <MapPin size={16} className="text-[#F59E0B]" />
              <span>{heroLocation}</span>
            </motion.div>

            {/* CTAs */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 mb-8"
            >
              <a
                href={heroPrimaryLink}
                className="px-8 py-4 rounded-xl bg-[#F59E0B] hover:bg-[#D97706] text-[#0B192C] font-black text-sm uppercase tracking-wider text-center shadow-lg shadow-[#F59E0B]/30 hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <span>{heroPrimaryBtn}</span>
                <ArrowRight size={16} />
              </a>

              <a
                href={heroSecondaryLink}
                className="px-8 py-4 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 backdrop-blur-md text-white font-bold text-sm uppercase tracking-wider text-center transition-all flex items-center justify-center gap-2"
              >
                <span>{heroSecondaryBtn}</span>
                <ArrowRight size={16} className="text-[#F59E0B]" />
              </a>
            </motion.div>

            {/* Small Trust Line */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="text-xs font-semibold text-slate-300 tracking-wide flex items-center gap-2"
            >
              <ShieldCheck size={14} className="text-emerald-400" />
              <span>{heroTrust}</span>
            </motion.p>

          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────
          3. HERO QUICK INFORMATION (4 COMPACT GLASS / MODERN CARDS)
          ───────────────────────────────────────────────────────────────── */}
      <section className="relative z-20 -mt-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          <div className="bg-white rounded-2xl p-6 shadow-xl border border-slate-100 hover:border-[#F59E0B] transition-all group">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-[#1E40AF] flex items-center justify-center mb-4 group-hover:bg-[#1E40AF] group-hover:text-white transition-colors">
              <Zap size={24} />
            </div>
            <h3 className="font-extrabold text-sm uppercase tracking-wider text-slate-900 mb-1">
              {heroCard1Title}
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              {heroCard1Desc}
            </p>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-xl border border-slate-100 hover:border-[#F59E0B] transition-all group">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
              <Clock size={24} />
            </div>
            <h3 className="font-extrabold text-sm uppercase tracking-wider text-slate-900 mb-1">
              {heroCard2Title}
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              {heroCard2Desc}
            </p>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-xl border border-slate-100 hover:border-[#F59E0B] transition-all group">
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-4 group-hover:bg-amber-600 group-hover:text-white transition-colors">
              <Briefcase size={24} />
            </div>
            <h3 className="font-extrabold text-sm uppercase tracking-wider text-slate-900 mb-1">
              {heroCard3Title}
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              {heroCard3Desc}
            </p>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-xl border border-slate-100 hover:border-[#F59E0B] transition-all group">
            <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center mb-4 group-hover:bg-rose-600 group-hover:text-white transition-colors">
              <MapPin size={24} />
            </div>
            <h3 className="font-extrabold text-sm uppercase tracking-wider text-slate-900 mb-1">
              {heroCard4Title}
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              {heroCard4Desc}
            </p>
          </div>

        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────
          4. INTRODUCTION SECTION (WELCOME TO BITC)
          ───────────────────────────────────────────────────────────────── */}
      <section id="about" className="py-20 lg:py-28 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-12 gap-12 lg:gap-16 items-center">
            
            {/* Image Column */}
            <div className="lg:col-span-6">
              <div className="relative rounded-3xl overflow-hidden shadow-2xl border-4 border-slate-100">
                <img
                  src={aboutImage}
                  alt="Practical skills training at Breakthrough International Training College"
                  className="w-full h-[380px] sm:h-[450px] object-cover"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0B192C]/80 via-transparent to-transparent"></div>
                <div className="absolute bottom-6 left-6 right-6 text-white">
                  <span className="text-[10px] font-black uppercase tracking-widest text-[#F59E0B] block mb-1">
                    EXCELLENCE IN TVET TRAINING
                  </span>
                  <p className="font-bold text-sm sm:text-base leading-snug">
                    Over 80% Practical Hands-on Learning in Fully Equipped Labs & Studios
                  </p>
                </div>
              </div>
            </div>

            {/* Text Column */}
            <div className="lg:col-span-6 space-y-6">
              <div className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-[#1E40AF]">
                <Sparkles size={16} className="text-[#F59E0B]" />
                <span>{aboutPreHeading}</span>
              </div>

              <h2 className="text-3xl sm:text-4xl font-black text-slate-900 leading-tight">
                {aboutTitle}
              </h2>

              <p className="text-base text-slate-600 leading-relaxed font-normal">
                {aboutOverview}
              </p>

              <div className="space-y-4 pt-2">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-1">
                    <Check size={14} />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-slate-900">{aboutBullet1Title}</h4>
                    <p className="text-xs text-slate-500">{aboutBullet1Desc}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-1">
                    <Check size={14} />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-slate-900">{aboutBullet2Title}</h4>
                    <p className="text-xs text-slate-500">{aboutBullet2Desc}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-1">
                    <Check size={14} />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-slate-900">{aboutBullet3Title}</h4>
                    <p className="text-xs text-slate-500">{aboutBullet3Desc}</p>
                  </div>
                </div>
              </div>

              <div className="pt-4">
                <a
                  href="#courses"
                  className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-[#0B192C] hover:bg-[#1E40AF] text-white font-black text-xs uppercase tracking-wider transition-all"
                >
                  <span>DISCOVER BITC COURSES</span>
                  <ArrowRight size={14} className="text-[#F59E0B]" />
                </a>
              </div>

            </div>

          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────
          5. FEATURED COURSES & DYNAMIC COURSE DISCOVERY
          ───────────────────────────────────────────────────────────────── */}
      <section id="courses" className="py-20 bg-slate-50 border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          {/* Section Header */}
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-xs font-black uppercase tracking-widest text-[#1E40AF] block mb-2">
              ACADEMIC DEPARTMENTS & PROGRAMS
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
              EXPLORE OUR COURSES
            </h2>
            <p className="text-sm sm:text-base text-slate-600 mt-2">
              Choose a program that moves your career forward.
            </p>
          </div>

          {/* Search & Category Filter Toolbar */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-8">
            
            {/* Search Input */}
            <div className="relative w-full md:w-80">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search courses or skills..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white border border-slate-200 text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#1E40AF] shadow-sm"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Category Pills */}
            <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0 scrollbar-none">
              {Object.entries(categories).map(([key, cat]) => (
                <button
                  key={key}
                  onClick={() => setSelectedCategory(key)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider shrink-0 transition-all cursor-pointer ${
                    selectedCategory === key
                      ? 'bg-[#0B192C] text-[#F59E0B] shadow-md'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  <span>{cat.label}</span>
                  <span className="ml-1.5 text-[10px] opacity-75 font-mono">({cat.count})</span>
                </button>
              ))}
            </div>

          </div>

          {/* Dynamic Courses Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCourses.map(course => (
              <div
                key={course.id}
                className="bg-white rounded-2xl overflow-hidden border border-slate-200 shadow-md hover:shadow-xl hover:border-[#F59E0B] transition-all flex flex-col justify-between group"
              >
                {/* Course Card Header Image */}
                <div className="relative h-48 overflow-hidden bg-slate-900">
                  <img
                    src={course.image || 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?q=80&w=800&auto=format&fit=crop'}
                    alt={course.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent"></div>
                  
                  {/* Badge: Level */}
                  <div className="absolute top-3 left-3 bg-[#0B192C]/90 backdrop-blur-sm text-[#F59E0B] text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-lg border border-[#F59E0B]/30">
                    {course.level}
                  </div>

                  {/* Badge: Duration */}
                  <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm text-slate-800 text-[10px] font-bold px-2.5 py-1 rounded-lg shadow-sm flex items-center gap-1">
                    <Clock size={11} className="text-slate-500" />
                    <span>{course.duration}</span>
                  </div>

                  {/* Category Pill on bottom */}
                  <div className="absolute bottom-3 left-3 text-[10px] font-bold text-slate-200 uppercase tracking-wider">
                    {course.categoryLabel}
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-6 flex-1 flex flex-col justify-between space-y-4">
                  <div>
                    <h3 className="font-extrabold text-base text-slate-900 group-hover:text-[#1E40AF] transition-colors line-clamp-2">
                      {course.name}
                    </h3>
                    <p className="text-xs text-slate-600 mt-2 line-clamp-2 leading-relaxed">
                      {course.description}
                    </p>
                  </div>

                  {/* Key Skills Pills */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {course.skills.slice(0, 3).map((skill, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-semibold"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>

                  {/* Exam Board Info */}
                  <div className="border-t border-slate-100 pt-3 flex items-center justify-between text-[11px] text-slate-500">
                    <span className="font-medium">Exam Board:</span>
                    <span className="font-bold text-slate-700">{course.exams}</span>
                  </div>

                  {/* Action Buttons */}
                  <div className="grid grid-cols-2 gap-2 pt-2">
                    <button
                      onClick={() => setSelectedCourseModal(course)}
                      className="py-2.5 px-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold uppercase tracking-wider transition-all text-center cursor-pointer"
                    >
                      View Details
                    </button>
                    <button
                      onClick={() => handleApplyForCourse(course.name)}
                      className="py-2.5 px-3 rounded-xl bg-[#F59E0B] hover:bg-[#D97706] text-[#0B192C] text-xs font-black uppercase tracking-wider shadow-sm hover:shadow transition-all text-center flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <span>Apply Now</span>
                      <ArrowRight size={12} />
                    </button>
                  </div>

                </div>

              </div>
            ))}
          </div>

          {filteredCourses.length === 0 && (
            <div className="text-center py-12 bg-white rounded-2xl border border-slate-200">
              <HelpCircle size={36} className="mx-auto text-slate-400 mb-2" />
              <h3 className="font-bold text-slate-800 text-base">No courses matching your criteria</h3>
              <p className="text-xs text-slate-500 mt-1">Try searching with a different term or select another category.</p>
              <button
                onClick={() => { setSelectedCategory('all'); setSearchQuery(''); }}
                className="mt-4 px-4 py-2 rounded-xl bg-[#0B192C] text-white text-xs font-bold uppercase cursor-pointer"
              >
                Reset Filters
              </button>
            </div>
          )}

        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────
          6. WHY CHOOSE BITC (6 MODERN FEATURE CARDS)
          ───────────────────────────────────────────────────────────────── */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-xs font-black uppercase tracking-widest text-[#1E40AF] block mb-2">
              WHY BITC STANDS OUT
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
              {whyHeading}
            </h2>
            <p className="text-sm sm:text-base text-slate-600 mt-2">
              {whySubheading}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            
            {/* Card 1 */}
            <div className="p-8 rounded-3xl bg-slate-50 border border-slate-100 hover:shadow-xl hover:border-[#1E40AF] transition-all space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-100 text-[#1E40AF] flex items-center justify-center">
                <Zap size={24} />
              </div>
              <h3 className="font-black text-base text-slate-900 uppercase tracking-wide">
                {whyFeature1Title}
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                {whyFeature1Desc}
              </p>
            </div>

            {/* Card 2 */}
            <div className="p-8 rounded-3xl bg-slate-50 border border-slate-100 hover:shadow-xl hover:border-[#1E40AF] transition-all space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <Briefcase size={24} />
              </div>
              <h3 className="font-black text-base text-slate-900 uppercase tracking-wide">
                {whyFeature2Title}
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                {whyFeature2Desc}
              </p>
            </div>

            {/* Card 3 */}
            <div className="p-8 rounded-3xl bg-slate-50 border border-slate-100 hover:shadow-xl hover:border-[#1E40AF] transition-all space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center">
                <Clock size={24} />
              </div>
              <h3 className="font-black text-base text-slate-900 uppercase tracking-wide">
                {whyFeature3Title}
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                {whyFeature3Desc}
              </p>
            </div>

            {/* Card 4 */}
            <div className="p-8 rounded-3xl bg-slate-50 border border-slate-100 hover:shadow-xl hover:border-[#1E40AF] transition-all space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
                <Award size={24} />
              </div>
              <h3 className="font-black text-base text-slate-900 uppercase tracking-wide">
                {whyFeature4Title}
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                {whyFeature4Desc}
              </p>
            </div>

            {/* Card 5 */}
            <div className="p-8 rounded-3xl bg-slate-50 border border-slate-100 hover:shadow-xl hover:border-[#1E40AF] transition-all space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center">
                <MapPin size={24} />
              </div>
              <h3 className="font-black text-base text-slate-900 uppercase tracking-wide">
                {whyFeature5Title}
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                {whyFeature5Desc}
              </p>
            </div>

            {/* Card 6 */}
            <div className="p-8 rounded-3xl bg-slate-50 border border-slate-100 hover:shadow-xl hover:border-[#1E40AF] transition-all space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-teal-100 text-teal-700 flex items-center justify-center">
                <Users size={24} />
              </div>
              <h3 className="font-black text-base text-slate-900 uppercase tracking-wide">
                {whyFeature6Title}
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                {whyFeature6Desc}
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────
          7. TRAINING & EXAMINATION INFORMATION
          ───────────────────────────────────────────────────────────────── */}
      <section className="py-12 bg-slate-100 border-y border-slate-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="bg-white rounded-3xl p-8 sm:p-10 shadow-lg border-l-8 border-[#1E40AF] space-y-4">
            <div className="flex items-center gap-2.5 text-[#1E40AF] font-black text-xs uppercase tracking-widest">
              <ShieldCheck size={18} />
              <span>TRAINING & EXAMINATION</span>
            </div>

            <h3 className="text-xl sm:text-2xl font-black text-slate-900">
              {examHeading}
            </h3>

            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Students are advised to understand the specific assessment and exam board requirements applicable to their enrolled qualification.
            </p>

            {/* Highlighted Card */}
            <div className="bg-blue-50/80 border border-blue-200 rounded-2xl p-5 text-slate-800">
              <div className="flex items-center gap-2 text-xs font-black text-[#1E40AF] uppercase tracking-wider mb-2">
                <Sparkles size={14} className="text-[#F59E0B]" />
                <span>{examCardTitle}</span>
              </div>
              <p className="text-xs sm:text-sm font-semibold text-slate-900 leading-relaxed">
                {examCardText}
              </p>
            </div>

          </div>

        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────
          8. ACCREDITATION / REGISTRATION
          ───────────────────────────────────────────────────────────────── */}
      <section className="py-16 bg-[#0B192C] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          
          <span className="text-xs font-black uppercase tracking-widest text-[#F59E0B] block mb-2">
            OFFICIALLY RECOGNIZED QUALIFICATIONS
          </span>

          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white mb-8">
            {accredHeading}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-4xl mx-auto">
            
            <div className="bg-slate-800/80 border border-slate-700 p-6 rounded-2xl flex flex-col items-center justify-center space-y-2">
              <div className="w-12 h-12 rounded-xl bg-[#F59E0B]/20 text-[#F59E0B] flex items-center justify-center font-black text-lg">
                NITA
              </div>
              <h3 className="font-extrabold text-sm text-white uppercase tracking-wider">{accredBadge1Name}</h3>
              <p className="text-[11px] text-slate-300">{accredBadge1Sub}</p>
            </div>

            <div className="bg-slate-800/80 border border-slate-700 p-6 rounded-2xl flex flex-col items-center justify-center space-y-2">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-black text-lg">
                KNEC
              </div>
              <h3 className="font-extrabold text-sm text-white uppercase tracking-wider">{accredBadge2Name}</h3>
              <p className="text-[11px] text-slate-300">{accredBadge2Sub}</p>
            </div>

            <div className="bg-slate-800/80 border border-slate-700 p-6 rounded-2xl flex flex-col items-center justify-center space-y-2">
              <div className="w-12 h-12 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center font-black text-lg">
                CDACC
              </div>
              <h3 className="font-extrabold text-sm text-white uppercase tracking-wider">{accredBadge3Name}</h3>
              <p className="text-[11px] text-slate-300">{accredBadge3Sub}</p>
            </div>

          </div>

          <p className="text-[11px] text-slate-400 font-mono mt-8">
            {accredTvetaReg}
          </p>

        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────
          9. ADMISSIONS 4-STEP PROCESS & APPLICATION FORM
          ───────────────────────────────────────────────────────────────── */}
      <section id="admissions" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          {/* Section Header */}
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-xs font-black uppercase tracking-widest text-[#1E40AF] block mb-2">
              HOW TO JOIN BITC
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
              {admHeading}
            </h2>
            <p className="text-sm sm:text-base text-slate-600 mt-2">
              {admSubheading}
            </p>
          </div>

          {/* 4-Step Process Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
            
            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 relative group hover:border-[#1E40AF] transition-all">
              <span className="text-3xl font-black text-slate-300 group-hover:text-[#1E40AF] transition-colors block mb-2 font-mono">
                01
              </span>
              <h3 className="font-black text-sm uppercase tracking-wider text-slate-900 mb-1">
                {admStep1Title}
              </h3>
              <p className="text-xs text-slate-600">
                {admStep1Desc}
              </p>
            </div>

            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 relative group hover:border-[#1E40AF] transition-all">
              <span className="text-3xl font-black text-slate-300 group-hover:text-[#1E40AF] transition-colors block mb-2 font-mono">
                02
              </span>
              <h3 className="font-black text-sm uppercase tracking-wider text-slate-900 mb-1">
                {admStep2Title}
              </h3>
              <p className="text-xs text-slate-600">
                {admStep2Desc}
              </p>
            </div>

            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 relative group hover:border-[#1E40AF] transition-all">
              <span className="text-3xl font-black text-slate-300 group-hover:text-[#1E40AF] transition-colors block mb-2 font-mono">
                03
              </span>
              <h3 className="font-black text-sm uppercase tracking-wider text-slate-900 mb-1">
                {admStep3Title}
              </h3>
              <p className="text-xs text-slate-600">
                {admStep3Desc}
              </p>
            </div>

            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 relative group hover:border-[#1E40AF] transition-all">
              <span className="text-3xl font-black text-slate-300 group-hover:text-[#1E40AF] transition-colors block mb-2 font-mono">
                04
              </span>
              <h3 className="font-black text-sm uppercase tracking-wider text-slate-900 mb-1">
                {admStep4Title}
              </h3>
              <p className="text-xs text-slate-600">
                {admStep4Desc}
              </p>
            </div>

          </div>

          {/* Interactive Enrollment / Inquiry Application Form */}
          <div className="max-w-3xl mx-auto bg-slate-900 text-white rounded-3xl p-8 sm:p-12 shadow-2xl border border-slate-800">
            
            <div className="text-center mb-8">
              <span className="text-xs font-black uppercase tracking-widest text-[#F59E0B] block mb-1">
                ONLINE APPLICATION PORTAL
              </span>
              <h3 className="text-2xl font-black text-white">
                September 2026 Admissions
              </h3>
              <p className="text-xs text-slate-300 mt-1">
                Fill this form to receive your instant provisional admission offer.
              </p>
            </div>

            {submitSuccess && lastSubmission ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-emerald-950/80 border border-emerald-500 rounded-2xl p-6 text-center space-y-4"
              >
                <div className="w-12 h-12 bg-emerald-500 text-white rounded-full flex items-center justify-center mx-auto">
                  <Check size={24} />
                </div>
                <h4 className="font-black text-lg text-white">
                  Application Submitted Successfully!
                </h4>
                <p className="text-xs text-emerald-200 max-w-md mx-auto">
                  Congratulations <strong>{lastSubmission.name}</strong>! Your application for <strong>{lastSubmission.course}</strong> has been registered.
                </p>
                <div className="p-3 bg-slate-900/80 rounded-xl inline-block border border-emerald-500/40">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Provisional Admission Number:</span>
                  <span className="font-mono font-black text-base text-[#F59E0B]">{lastSubmission.admissionNumber}</span>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                  <button
                    onClick={() => handlePrintAdmissionLetter(lastSubmission)}
                    className="w-full sm:w-auto px-6 py-3 rounded-xl bg-[#F59E0B] hover:bg-[#D97706] text-[#0B192C] font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Printer size={16} />
                    <span>Print Admission Letter</span>
                  </button>

                  <button
                    onClick={() => setSubmitSuccess(false)}
                    className="w-full sm:w-auto px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs uppercase cursor-pointer"
                  >
                    Apply for Another Student
                  </button>
                </div>
              </motion.div>
            ) : (
              <form onSubmit={handleFormSubmit} className="space-y-4">
                
                {formError && (
                  <div className="p-3 rounded-xl bg-rose-900/50 border border-rose-500 text-rose-200 text-xs font-semibold">
                    {formError}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Grace Njeri"
                      value={formData.fullName}
                      onChange={e => setFormData({ ...formData, fullName: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 text-xs font-medium focus:outline-none focus:border-[#F59E0B]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="e.g. grace@gmail.com"
                      value={formData.email}
                      onChange={e => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 text-xs font-medium focus:outline-none focus:border-[#F59E0B]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">
                      Phone / WhatsApp Contact *
                    </label>
                    <input
                      type="tel"
                      required
                      placeholder="e.g. 0712 345 678"
                      value={formData.phone}
                      onChange={e => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 text-xs font-medium focus:outline-none focus:border-[#F59E0B]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">
                      Select Course of Interest *
                    </label>
                    <select
                      value={formData.courseInterest}
                      onChange={e => setFormData({ ...formData, courseInterest: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs font-medium focus:outline-none focus:border-[#F59E0B]"
                    >
                      <option value="">-- Choose a course --</option>
                      {dbCourses.map(c => (
                        <option key={c.id} value={c.name}>
                          {c.name} ({c.level})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">
                      Intake Period
                    </label>
                    <select
                      value={formData.intakePeriod}
                      onChange={e => setFormData({ ...formData, intakePeriod: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs font-medium focus:outline-none focus:border-[#F59E0B]"
                    >
                      <option value="September 2026 Intake">September 2026 Intake (Ongoing)</option>
                      <option value="January 2027 Intake">January 2027 Intake</option>
                      <option value="May 2027 Intake">May 2027 Intake</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">
                      Current Residence / Town
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Thika, Kiambu, Nairobi"
                      value={formData.address}
                      onChange={e => setFormData({ ...formData, address: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 text-xs font-medium focus:outline-none focus:border-[#F59E0B]"
                    />
                  </div>
                </div>

                <div className="pt-4 flex flex-col sm:flex-row items-center gap-4">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-4 rounded-xl bg-[#F59E0B] hover:bg-[#D97706] text-[#0B192C] font-black text-xs uppercase tracking-wider shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <span>Processing Application...</span>
                    ) : (
                      <>
                        <span>APPLY ONLINE NOW</span>
                        <ArrowRight size={16} />
                      </>
                    )}
                  </button>

                  <a
                    href={`https://wa.me/${whatsappNumber}?text=${encodeURIComponent("Hello Admissions Office, I would like to inquire about enrolling for courses at Breakthrough International Training College Thika.")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full sm:w-auto px-6 py-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-wider text-center transition-all flex items-center justify-center gap-2"
                  >
                    <MessageCircle size={16} />
                    <span>TALK TO ADMISSIONS</span>
                  </a>
                </div>

              </form>
            )}

          </div>

          {/* Official Bank Account & Tuition Payment Card */}
          <div className="max-w-3xl mx-auto mt-8 bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-md">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5 mb-5">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-blue-50 text-[#1E40AF] flex items-center justify-center shrink-0">
                  <Building2 size={24} />
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-[#F59E0B]">OFFICIAL INSTITUTION ACCOUNT</span>
                  <h4 className="text-base font-black text-slate-900">Tuition Fee & Bank Deposit Details</h4>
                </div>
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold self-start sm:self-auto">
                <ShieldCheck size={14} />
                <span>Verified Direct Account</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Bank Account Name</span>
                <p className="font-extrabold text-slate-900 text-sm leading-tight">{bankAccountName}</p>
                <p className="text-[11px] text-slate-500 font-semibold">{bankName} &bull; {bankBranch} Branch</p>
              </div>

              <div className="bg-slate-900 text-white p-4 rounded-2xl border border-slate-800 space-y-1 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Account Number (A/C No.)</span>
                  <div className="flex items-center justify-between mt-1">
                    <p className="font-mono font-black text-lg text-[#F59E0B] tracking-wider select-all">{bankAccountNumber}</p>
                    <button
                      onClick={() => handleCopyAccount(bankAccountNumber)}
                      className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                      title="Copy Account Number"
                    >
                      {copiedAccount ? (
                        <>
                          <CheckCheck size={13} className="text-emerald-400" />
                          <span className="text-emerald-400">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy size={13} />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
                {bankPaybill && (
                  <p className="text-[11px] text-slate-300 pt-1 border-t border-slate-800">
                    Paybill: <strong className="text-white font-mono">{bankPaybill}</strong> &bull; Acc: <strong className="text-white font-mono">{bankAccountNumber}</strong>
                  </p>
                )}
              </div>
            </div>

            <div className="mt-4 p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px] leading-relaxed flex items-start gap-2.5">
              <span className="text-base shrink-0">⚠️</span>
              <div>
                <strong className="font-bold">Payment Guidance:</strong> {bankInstructions}
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────
          10. INTAKE CTA BANNER
          ───────────────────────────────────────────────────────────────── */}
      <section className="py-16 bg-gradient-to-r from-[#0B192C] via-[#1E40AF] to-[#0B192C] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
          
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#F59E0B]/20 border border-[#F59E0B]/50 text-[#F59E0B] text-xs font-black uppercase tracking-widest">
            <Sparkles size={14} />
            <span>{intakeBannerTitle}</span>
          </div>

          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white max-w-3xl mx-auto">
            {intakeBannerSubtitle}
          </h2>

          <p className="text-sm sm:text-base text-slate-200 font-bold">
            {intakeBannerLocation}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
            <a
              href="#admissions"
              className="w-full sm:w-auto px-8 py-4 rounded-xl bg-[#F59E0B] hover:bg-[#D97706] text-[#0B192C] font-black text-xs uppercase tracking-wider shadow-lg hover:scale-105 transition-all"
            >
              {intakeBannerBtnText}
            </a>

            <a
              href="#courses"
              className="w-full sm:w-auto px-8 py-4 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold text-xs uppercase tracking-wider transition-all"
            >
              {intakeBannerSecondaryBtnText}
            </a>
          </div>

        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────
          11. STUDENT EXPERIENCE & CAMPUS GALLERY
          ───────────────────────────────────────────────────────────────── */}
      <section id="gallery" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-xs font-black uppercase tracking-widest text-[#1E40AF] block mb-2">
              CAMPUS LIFE & FACILITIES
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
              {galleryHeading}
            </h2>
            <p className="text-sm sm:text-base text-slate-600 mt-2">
              {gallerySubheading}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {galleryItems.map((item, index) => (
              <div
                key={index}
                onClick={() => setActiveLightboxImg(item.url)}
                className="group relative rounded-2xl overflow-hidden aspect-[4/3] bg-slate-900 cursor-pointer shadow-md hover:shadow-xl transition-all"
              >
                <img
                  src={item.url}
                  alt={item.title}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-transparent to-transparent opacity-80 group-hover:opacity-95 transition-opacity"></div>
                
                <div className="absolute bottom-4 left-4 right-4 text-white">
                  <span className="text-[9px] font-black uppercase tracking-wider text-[#F59E0B] block">
                    {item.tag}
                  </span>
                  <p className="text-xs font-bold leading-tight mt-0.5">
                    {item.title}
                  </p>
                </div>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────
          12. TESTIMONIALS (REAL STUDENT FEEDBACK)
          ───────────────────────────────────────────────────────────────── */}
      <section className="py-20 bg-slate-50 border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-xs font-black uppercase tracking-widest text-[#1E40AF] block mb-2">
              ALUMNI STORIES
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
              {testimonialsHeading}
            </h2>
            <p className="text-sm sm:text-base text-slate-600 mt-2">
              Hear from graduates thriving in industry, healthcare, and entrepreneurship.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((t, idx) => (
              <div
                key={idx}
                className="bg-white p-8 rounded-3xl border border-slate-200 shadow-md flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  <div className="flex gap-1 text-[#F59E0B]">
                    {[...Array(t.rating || 5)].map((_, i) => (
                      <Star key={i} size={16} fill="currentColor" />
                    ))}
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed italic">
                    "{t.quote}"
                  </p>
                </div>

                <div className="border-t border-slate-100 pt-4">
                  <h4 className="font-extrabold text-sm text-slate-900">{t.name}</h4>
                  <p className="text-[11px] font-semibold text-[#1E40AF]">{t.role}</p>
                  <p className="text-[10px] text-slate-400">{t.workplace}</p>
                </div>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────
          13. CONTACT & CAMPUS LOCATION
          ───────────────────────────────────────────────────────────────── */}
      <section id="contact" className="py-20 bg-white border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-xs font-black uppercase tracking-widest text-[#1E40AF] block mb-2">
              FIND US IN THIKA
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
              {contactHeading}
            </h2>
            <p className="text-sm sm:text-base font-bold text-slate-700 mt-2">
              {campusLocation}
            </p>
          </div>

          <div className="grid lg:grid-cols-12 gap-8 items-start">
            
            {/* Left: Contact Info Cards */}
            <div className="lg:col-span-5 space-y-4">
              
              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-blue-100 text-[#1E40AF] flex items-center justify-center shrink-0">
                  <MapPin size={20} />
                </div>
                <div>
                  <h4 className="font-black text-xs uppercase tracking-wider text-slate-900">Campus Address</h4>
                  <p className="text-xs text-slate-600 mt-1">
                    {campusLocation}
                  </p>
                </div>
              </div>

              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <Phone size={20} />
                </div>
                <div>
                  <h4 className="font-black text-xs uppercase tracking-wider text-slate-900">Phone Contacts</h4>
                  <p className="text-xs text-slate-600 mt-1 font-mono">
                    <a href={`tel:${collegePhonePrimary}`} className="hover:text-blue-600 font-bold block">{collegePhonePrimary}</a>
                    <a href={`tel:${collegePhoneSecondary}`} className="hover:text-blue-600 font-bold block">{collegePhoneSecondary}</a>
                  </p>
                </div>
              </div>

              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                  <Mail size={20} />
                </div>
                <div>
                  <h4 className="font-black text-xs uppercase tracking-wider text-slate-900">Official Email</h4>
                  <p className="text-xs text-slate-600 mt-1 font-mono">
                    <a href={`mailto:${collegeEmail}`} className="hover:text-blue-600 font-bold">{collegeEmail}</a>
                  </p>
                </div>
              </div>

              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                  <Clock size={20} />
                </div>
                <div>
                  <h4 className="font-black text-xs uppercase tracking-wider text-slate-900">Admissions Office Hours</h4>
                  <p className="text-xs text-slate-600 mt-1 whitespace-pre-line">
                    {officeHours}
                  </p>
                </div>
              </div>

              <div className="bg-slate-900 text-white p-6 rounded-2xl border border-slate-800 flex items-start gap-4 shadow-sm">
                <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">
                  <Building2 size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-black text-xs uppercase tracking-wider text-[#F59E0B]">Official Bank Account</h4>
                  <p className="text-xs text-slate-200 mt-1 font-bold truncate">{bankAccountName}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="font-mono text-sm font-black text-white bg-white/10 px-2 py-0.5 rounded select-all">{bankAccountNumber}</span>
                    <span className="text-[11px] text-slate-400 font-semibold">({bankName}, {bankBranch})</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <a
                  href="https://maps.google.com/?q=-1.073224,37.097750"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-3 px-4 rounded-xl bg-[#0B192C] hover:bg-[#1E40AF] text-white text-xs font-black uppercase tracking-wider text-center transition-all flex items-center justify-center gap-2"
                >
                  <Navigation size={14} className="text-[#F59E0B]" />
                  <span>GET DIRECTIONS</span>
                </a>

                <a
                  href={`https://wa.me/${whatsappNumber}?text=${encodeURIComponent("Hello Breakthrough College, I am reaching out regarding course applications.")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-wider text-center transition-all flex items-center justify-center gap-2"
                >
                  <MessageCircle size={14} />
                  <span>WHATSAPP US</span>
                </a>
              </div>

            </div>

            {/* Right: Embedded Interactive Map & GPS Calibration */}
            <div className="lg:col-span-7 space-y-4">
              <div className="rounded-3xl overflow-hidden border border-slate-200 shadow-md h-80 bg-slate-100 relative">
                <iframe
                  title="BITC Campus Map"
                  src={mapEmbedUrl}
                  className="w-full h-full border-0"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                ></iframe>
              </div>

              {/* GPS Distance Tool */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2.5">
                  <Locate size={18} className="text-[#1E40AF]" />
                  <div>
                    <span className="font-bold text-slate-800 block">Calculate Distance to Campus</span>
                    <span className="text-[11px] text-slate-500">Find how far you are from {campusLocation}</span>
                  </div>
                </div>

                <button
                  onClick={handleGetCampusDistance}
                  className="px-4 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-100 font-bold text-slate-800 text-xs shrink-0 flex items-center gap-1.5 cursor-pointer"
                >
                  {gpsState === 'locating' ? (
                    <RotateCw size={13} className="animate-spin text-[#1E40AF]" />
                  ) : (
                    <Compass size={13} className="text-[#1E40AF]" />
                  )}
                  <span>{userDistanceKm !== null ? `${userDistanceKm.toFixed(1)} km away` : 'Check Distance'}</span>
                </button>
              </div>

            </div>

          </div>

        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────
          14. FOOTER (PREMIUM MULTI-COLUMN FOOTER)
          ───────────────────────────────────────────────────────────────── */}
      <footer className="bg-[#0B192C] text-white pt-16 pb-12 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
            
            {/* Col 1: Brand & Description */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                {customLogoUrl ? (
                  <img
                    src={customLogoUrl}
                    alt={collegeName}
                    className="h-10 w-auto max-w-[120px] object-contain rounded-lg bg-white/10 p-1"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-xl bg-[#F59E0B] text-[#0B192C] font-black text-lg flex items-center justify-center">
                    {headerBrandTitle.charAt(0)}
                  </div>
                )}
                <div className="flex flex-col">
                  <span className="font-extrabold text-sm tracking-wider uppercase">{headerBrandTitle}</span>
                  <span className="text-[10px] text-[#F59E0B] tracking-widest uppercase font-semibold">{headerBrandSubtitle}</span>
                </div>
              </div>

              <p className="text-xs text-slate-400 leading-relaxed">
                {footerDesc}
              </p>

              <div className="pt-2">
                <span className="text-[10px] font-mono text-emerald-400 block">
                  {accredTvetaReg}
                </span>
              </div>
            </div>

            {/* Col 2: Quick Links */}
            <div>
              <h4 className="font-black text-xs uppercase tracking-widest text-[#F59E0B] mb-4">
                QUICK LINKS
              </h4>
              <ul className="space-y-2.5 text-xs text-slate-300 font-medium">
                <li><a href="#hero" className="hover:text-white transition-colors">Home</a></li>
                <li><a href="#about" className="hover:text-white transition-colors">About Us</a></li>
                <li><a href="#courses" className="hover:text-white transition-colors">Courses</a></li>
                <li><a href="#admissions" className="hover:text-white transition-colors">Admissions</a></li>
                <li><a href="#contact" className="hover:text-white transition-colors">Contact</a></li>
              </ul>
            </div>

            {/* Col 3: Student Links */}
            <div>
              <h4 className="font-black text-xs uppercase tracking-widest text-[#F59E0B] mb-4">
                STUDENT
              </h4>
              <ul className="space-y-2.5 text-xs text-slate-300 font-medium">
                <li><a href="#admissions" className="hover:text-white transition-colors">Apply Online</a></li>
                <li><Link to="/auth" className="hover:text-white transition-colors">Student Portal</Link></li>
                <li><a href="#courses" className="hover:text-white transition-colors">Course Catalog</a></li>
                <li><Link to="/verify/certificate" className="hover:text-white transition-colors">Certificate Verification</Link></li>
              </ul>
            </div>

            {/* Col 4: Contact */}
            <div>
              <h4 className="font-black text-xs uppercase tracking-widest text-[#F59E0B] mb-4">
                CONTACT
              </h4>
              <ul className="space-y-2 text-xs text-slate-300">
                <li className="font-bold text-white">{campusLocation}</li>
                <li>Tel: <a href={`tel:${collegePhonePrimary}`} className="hover:text-[#F59E0B] font-mono">{collegePhonePrimary}</a></li>
                <li>Alt: <a href={`tel:${collegePhoneSecondary}`} className="hover:text-[#F59E0B] font-mono">{collegePhoneSecondary}</a></li>
                <li>Email: <a href={`mailto:${collegeEmail}`} className="hover:text-[#F59E0B] font-mono">{collegeEmail}</a></li>
              </ul>
            </div>

          </div>

          <div className="border-t border-slate-800 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-slate-400">
            <p>
              {footerCopyright}
            </p>
            <div className="flex gap-4">
              <span className="hover:text-white cursor-pointer">Privacy Policy</span>
              <span className="hover:text-white cursor-pointer">Terms & Conditions</span>
              <span className="hover:text-white cursor-pointer">TVETA Standards</span>
            </div>
          </div>

        </div>
      </footer>

      {/* ─────────────────────────────────────────────────────────────────
          COURSE DETAILS MODAL
          ───────────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {selectedCourseModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 relative"
            >
              {/* Modal Header Image */}
              <div className="relative h-56 bg-slate-900">
                <img
                  src={selectedCourseModal.image || 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?q=80&w=800&auto=format&fit=crop'}
                  alt={selectedCourseModal.name}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/40 to-transparent"></div>
                
                <button
                  onClick={() => setSelectedCourseModal(null)}
                  className="absolute top-4 right-4 p-2 rounded-full bg-slate-900/80 hover:bg-slate-900 text-white transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>

                <div className="absolute bottom-4 left-6 right-6 text-white">
                  <span className="text-[10px] font-black uppercase tracking-wider text-[#F59E0B] px-2.5 py-1 rounded bg-black/40 backdrop-blur-sm inline-block mb-1">
                    {selectedCourseModal.categoryLabel}
                  </span>
                  <h3 className="text-xl sm:text-2xl font-black leading-tight text-white">
                    {selectedCourseModal.name}
                  </h3>
                </div>
              </div>

              {/* Modal Body */}
              <div className="p-6 sm:p-8 space-y-6">
                
                {/* Meta details */}
                <div className="grid grid-cols-3 gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100 text-center">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Qualification</span>
                    <span className="font-black text-xs text-slate-900">{selectedCourseModal.level}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Duration</span>
                    <span className="font-black text-xs text-slate-900">{selectedCourseModal.duration}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Exam Board</span>
                    <span className="font-black text-xs text-emerald-700">{selectedCourseModal.exams}</span>
                  </div>
                </div>

                <div>
                  <h4 className="font-bold text-xs uppercase tracking-wider text-slate-900 mb-1">Course Description</h4>
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                    {selectedCourseModal.description}
                  </p>
                </div>

                <div>
                  <h4 className="font-bold text-xs uppercase tracking-wider text-slate-900 mb-1">Minimum Requirements</h4>
                  <p className="text-xs sm:text-sm text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-200">
                    {selectedCourseModal.requirements}
                  </p>
                </div>

                <div>
                  <h4 className="font-bold text-xs uppercase tracking-wider text-slate-900 mb-2">Key Competencies & Practical Skills</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedCourseModal.skills.map((s, i) => (
                      <span
                        key={i}
                        className="px-3 py-1.5 rounded-lg bg-blue-50 text-[#1E40AF] text-xs font-bold flex items-center gap-1.5"
                      >
                        <Check size={13} className="text-[#F59E0B]" />
                        <span>{s}</span>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Modal Footer CTA */}
                <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase block font-semibold">Ready to enroll?</span>
                    <span className="text-xs font-black text-slate-800">September 2026 Admissions Open</span>
                  </div>

                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    <button
                      onClick={() => setSelectedCourseModal(null)}
                      className="w-1/2 sm:w-auto px-5 py-3 rounded-xl border border-slate-300 hover:bg-slate-100 text-xs font-bold uppercase text-slate-700 cursor-pointer"
                    >
                      Close
                    </button>
                    <button
                      onClick={() => handleApplyForCourse(selectedCourseModal.name)}
                      className="w-1/2 sm:w-auto px-6 py-3 rounded-xl bg-[#F59E0B] hover:bg-[#D97706] text-[#0B192C] text-xs font-black uppercase tracking-wider shadow-md hover:shadow-lg flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <span>Apply Now</span>
                      <ArrowRight size={14} />
                    </button>
                  </div>
                </div>

              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─────────────────────────────────────────────────────────────────
          LIGHTBOX FOR GALLERY PHOTOS
          ───────────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {activeLightboxImg && (
          <div
            onClick={() => setActiveLightboxImg(null)}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md cursor-pointer"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="relative max-w-4xl max-h-[85vh] w-full"
              onClick={e => e.stopPropagation()}
            >
              <img
                src={activeLightboxImg}
                alt="Campus Life at BITC"
                className="w-full h-full object-contain rounded-2xl shadow-2xl border border-slate-700"
                referrerPolicy="no-referrer"
              />
              <button
                onClick={() => setActiveLightboxImg(null)}
                className="absolute top-4 right-4 p-2 rounded-full bg-black/70 text-white hover:bg-black transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
