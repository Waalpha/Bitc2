import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, addDoc } from 'firebase/firestore';
import { useAuth } from '../components/AuthProvider';
import { useNavigate, Link } from 'react-router-dom';
import {
  GraduationCap,
  Phone,
  Mail,
  MapPin,
  ArrowRight,
  BookOpen,
  Users,
  Award,
  Building,
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
  Plug,
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
  Navigation
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Recommended Color Palette & Fallbacks
// Primary: #1E40AF (Royal Blue)
// Secondary: #10B981 (Emerald Green)
// Accent: #F59E0B (Amber/Gold)
// Background: #F8FAFC
// Text: #1F2937

interface Course {
  id: string;
  name: string;
  category: 'cosmetology' | 'ict' | 'healthcare' | 'hospitality' | 'engineering' | 'theology';
  duration: string;
  requirements: string;
  exams: string;
  skills: string[];
  description: string;
  featured?: boolean;
}

const COURSES: Course[] = [
  {
    id: 'cosm-1',
    name: 'Diploma in Beauty Therapy, Skincare & Professional Makeup',
    category: 'cosmetology',
    duration: '1 Year',
    requirements: 'KCSE D Plain and above (or equivalent)',
    exams: 'NITA / CDACC Exams',
    skills: ['Aesthetic Skincare', 'Professional Makeup Artistry', 'Body Therapy', 'Nail Technology Services'],
    description: 'Master the art of facial care, advanced aesthetics, bridal makeup, and parlor operations under expert supervision.',
    featured: true
  },
  {
    id: 'cosm-2',
    name: 'Certificate in Hairdressing, Advanced Styling & Barbering',
    category: 'cosmetology',
    duration: '6 Months',
    requirements: 'KCSE Open / Secondary or equivalent',
    exams: 'NITA Grade III/II/I',
    skills: ['Chemical Relaxing & Retouch', 'Blowdrying & Styler Operations', 'Weaving & Braiding', 'Modern Men Barbering'],
    description: 'Practical training focusing on high-demand styling routines, chemical hair management, and trendy cuts.',
    featured: false
  },
  {
    id: 'ict-1',
    name: 'Diploma in Software Engineering & Web Development',
    category: 'ict',
    duration: '1 Year',
    requirements: 'KCSE C- and above',
    exams: 'TVET CDACC Certified',
    skills: ['Full-Stack Javascript/React', 'Information Database Management', 'Git & Python Programming', 'API Systems Design'],
    description: 'In-depth coding boot camp designed to build database-driven cloud applications and launch careers in tech.',
    featured: true
  },
  {
    id: 'ict-2',
    name: 'Certificate in Computer Packages & Digital Commerce Systems',
    category: 'ict',
    duration: '3 Months',
    requirements: 'Open to All',
    exams: 'Internal / NITA Assessments',
    skills: ['Advanced MS Office Suite', 'Operating Devices Systems', 'AI Productivity Tools', 'Digital Safety Basics'],
    description: 'Essential computer skills to empower administration workers, business owners, and entry-level employees.',
    featured: false
  },
  {
    id: 'heal-1',
    name: 'Certificate in Community Health & Professional Caregiver Studies',
    category: 'healthcare',
    duration: '12 Months',
    requirements: 'KCSE D- minus and above',
    exams: 'TVET CDACC Professional Assessment',
    skills: ['Elderly Care & Geriatrics', 'Palliative & Nursing Support', 'First Aid Responder', 'Vital Signs Record'],
    description: 'The golden pathway to securing homecare, elderly care, and hospital auxiliary roles locally and internationally.',
    featured: true
  },
  {
    id: 'heal-2',
    name: 'Diploma in Nursing Aide, Anatomy & Patient Nutrition',
    category: 'healthcare',
    duration: '1.5 Years',
    requirements: 'KCSE C- and above',
    exams: 'TVET CDACC Diploma',
    skills: ['Human Anatomy Basics', 'Clinical Hygiene Management', 'Patient Attendant Ethics', 'Emergency Interventions'],
    description: 'Comprehensive assistant healthcare provider curriculum containing mandatory external hospital internships.',
    featured: false
  },
  {
    id: 'hosp-1',
    name: 'Certificate in Professional Cookery, General Baking & Cake Decoration',
    category: 'hospitality',
    duration: '6 Months',
    requirements: 'Standard Open Secondary',
    exams: 'KNEC / NITA Assessments',
    skills: ['Pastry & Oven Formulations', 'Culinary Sauce Methods', 'Cake Structural Frosting', 'Kitchen Hygiene Standards'],
    description: 'Hands-on training in international food preparation, sweet pastry engineering, and advanced cake art design.',
    featured: true
  },
  {
    id: 'hosp-2',
    name: 'Diploma in Catering & Hospitality Management',
    category: 'hospitality',
    duration: '1.5 Years',
    requirements: 'KCSE D Plain and above',
    exams: 'KNEC Exam Series',
    skills: ['Food Costing Systems', 'Service Table Hospitality', 'Beverages & Mocktail Mixology', 'Hotel Supervisor Ethics'],
    description: 'Acquire hotel operation secrets, banquet service coordination, and catering staff management competence.',
    featured: false
  },
  {
    id: 'eng-1',
    name: 'Certificate in Solar PV Technology & Electrical Wiring',
    category: 'engineering',
    duration: '6 Months',
    requirements: 'Open / KCSE D Plain recommendation',
    exams: 'NITA Grade Certification',
    skills: ['Solar Array System Setup', 'Domestic Conduit Piping', 'Circuit Fault Diagnostics', 'Electrical Safety Regs'],
    description: 'A fast-paced program designed to meet the explosive African clean energy transition and construction industry.',
    featured: false
  },
  {
    id: 'eng-2',
    name: 'Diploma in Domestic & Industrial Electrical Engineering',
    category: 'engineering',
    duration: '1.5 Years',
    requirements: 'KCSE D+ and above',
    exams: 'KNEC Diploma Series',
    skills: ['Three-Phase System Wiring', 'Electrical Instrumentation', 'Generator Synchronization', 'Industrial Automation Tech'],
    description: 'Advance to advanced manufacturing plants installer, commercial contractor, and power grid maintenance supervisor.',
    featured: true
  },
  {
    id: 'theo-1',
    name: 'Certificate in Theology & Biblical Studies',
    category: 'theology',
    duration: '1 Year',
    requirements: 'KCSE D- minus / Secondary Certificate or equivalent',
    exams: 'Christian Education Board Exams',
    skills: ['Biblical Interpretation', 'Christian Ministry Ethics', 'Basic Pastoral Counseling', 'Homiletics & Preaching'],
    description: 'Foundations of Christian doctrine, spiritual formation, and pulpit practice designed to empower aspiring church lay leaders.',
    featured: false
  },
  {
    id: 'theo-2',
    name: 'Diploma in Theology & Christian Ministry',
    category: 'theology',
    duration: '2 Years',
    requirements: 'KCSE D Plain and above (or equivalent certificate)',
    exams: 'Joint Theological Board Assessments',
    skills: ['Systematic Theology', 'Chaplaincy Care', 'Pastoral Counseling', 'Church Administration Skills'],
    description: 'A comprehensive guide to ecclesiology, sermon preparation, local church planting, and effective parish governance.',
    featured: true
  }
];

const GALLERY_IMGS = [
  {
    url: 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?q=80&w=800&auto=format&fit=crop',
    title: 'Modern Learning Facilities',
    category: 'campus'
  },
  {
    url: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?q=80&w=800&auto=format&fit=crop',
    title: 'Hands-on Cosmetology & Makeup Practice',
    category: 'cosmetology'
  },
  {
    url: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?q=80&w=800&auto=format&fit=crop',
    title: 'High-Tech Computer Science Lab',
    category: 'ict'
  },
  {
    url: 'https://images.unsplash.com/photo-1556910103-1c02745aae4d?q=80&w=800&auto=format&fit=crop',
    title: 'Professional Baking & Pastry Class',
    category: 'hospitality'
  },
  {
    url: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?q=80&w=800&auto=format&fit=crop',
    title: 'Practical Caregiver Lab & Patient Care Studies',
    category: 'healthcare'
  },
  {
    url: 'https://images.unsplash.com/photo-1523050853064-85216775870f?q=80&w=800&auto=format&fit=crop',
    title: 'Breakthrough Graduation Day Ceremony',
    category: 'campus'
  }
];

const TESTIMONIALS = [
  {
    name: 'Abigail Wambui',
    role: 'Software Developer Graduate',
    workplace: 'Fintech Firm, Nairobi',
    quote: 'The ICT Software Engineering program at BITC was completely project-oriented. I learned web programming build-outs, databases, and general system architecture. The mentors helped me secure a front-end role before my final examinations!',
    rating: 5,
    avatar: '👩‍💻'
  },
  {
    name: 'Kevin Kiprop',
    role: 'Healthcare Caregiver Alumnus',
    workplace: 'Professional Care Home, United Kingdom',
    quote: 'Thanks to TVET CDACC caregiver training at Breakthrough, I excelled in the UK relocation care standards. The practical sessions on elder client treatment, nursing aide ethics, and basic clinical first aid remain the gold standard.',
    rating: 5,
    avatar: '👨‍⚕️'
  },
  {
    name: 'Gladys Atieno',
    role: 'Cosmetology & Hairdressing Lead',
    workplace: 'Owner, Royal Glitz Spa - Thika',
    quote: 'Under BITC beauty educators, I acquired stellar secrets of facial therapy, bridal makeup artistry, and salon financial management. Today, my own spa employs three junior stylers certified from this very institution!',
    rating: 5,
    avatar: '💇‍♀️'
  }
];

export function PublicPortal() {
  const { user, userData, isAuthReady, settings } = useAuth();
  const navigate = useNavigate();

  // Dynamic public portal customization properties
  const portalTitle = settings?.publicHeroTitle || "Shaping Tomorrow's Professionals Today.";
  const portalDescription = settings?.publicHeroDescription || "Breakthrough International Training College offers world-class professional training accredited by NITA, KNEC, and TVET CDACC. Acquire highly practical, jobs-ready skillsets in ICT, Cosmetology, Healthcare Caregiver Studies, and Hospitality.";
  
  // Dynamic Hero Slideshow based on photos in system (publicHeroImages or publicHeroImageUrl)
  const heroImages = settings?.publicHeroImages && settings.publicHeroImages.length > 0
    ? settings.publicHeroImages
    : [settings?.publicHeroImageUrl || "https://images.unsplash.com/photo-1523050853064-85216775870f?q=80&w=2070&auto=format&fit=crop"];

  const [heroIndex, setHeroIndex] = useState(0);

  useEffect(() => {
    if (heroImages.length <= 1) return;
    const interval = setInterval(() => {
      setHeroIndex(prev => (prev + 1) % heroImages.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [heroImages.length]);

  const heroImage = heroImages[heroIndex];

  // Dynamic public gallery based on photos in system (portalGallery)
  const activeGalleryImgs = settings?.portalGallery && settings.portalGallery.length > 0
    ? settings.portalGallery.map((url, i) => ({
        url,
        title: `Campus Snap #${i + 1}`,
        category: i % 2 === 0 ? 'Campus Live' : 'Practical Session'
      }))
    : GALLERY_IMGS;

  // Sizes
  const titleSizeClass = settings?.publicHeroTitleSize || "text-3xl sm:text-4xl md:text-5xl lg:text-6xl";
  const descSizeClass = settings?.publicHeroDescriptionSize || "text-sm sm:text-base";

  // Alignments
  const alignClass = settings?.publicHeroAlign === 'center' ? 'text-center items-center lg:text-center lg:items-center' : settings?.publicHeroAlign === 'right' ? 'text-right items-end lg:text-right lg:items-end' : 'text-left items-start lg:text-left lg:items-start';
  const titleAlignClass = settings?.publicHeroAlign === 'center' ? 'text-center' : settings?.publicHeroAlign === 'right' ? 'text-right' : 'text-left';
  const descAlignClass = settings?.publicHeroAlign === 'center' ? 'text-center mx-auto' : settings?.publicHeroAlign === 'right' ? 'text-right ml-auto mr-0' : 'text-left mx-0';
  const selfAlignClass = settings?.publicHeroAlign === 'center' ? 'self-center' : settings?.publicHeroAlign === 'right' ? 'self-end lg:self-end' : 'self-center lg:self-start';
  const buttonsAlignClass = settings?.publicHeroAlign === 'center' ? 'justify-center w-full' : settings?.publicHeroAlign === 'right' ? 'justify-end lg:justify-end w-full' : 'justify-center lg:justify-start w-full';

  // Fonts
  const fontStyle = settings?.publicHeroFont || 'Inter';
  let titleFontFamily = 'font-sans';
  let descFontFamily = 'font-sans';
  
  if (fontStyle === 'Poppins') {
    titleFontFamily = 'font-poppins';
  } else if (fontStyle === 'Montserrat') {
    titleFontFamily = 'font-montserrat';
  } else if (fontStyle === 'Space Grotesk') {
    titleFontFamily = 'font-space-grotesk';
  }

  // Weight and Style Modifiers
  const titleWeightClass = settings?.publicHeroTitleBold !== false ? 'font-black' : 'font-medium';
  const titleItalicClass = settings?.publicHeroTitleItalic ? 'italic' : 'not-italic';
  const descWeightClass = settings?.publicHeroDescriptionBold ? 'font-bold' : 'font-medium';
  const descItalicClass = settings?.publicHeroDescriptionItalic ? 'italic' : 'not-italic';

  // Custom branding colors
  const primaryColor = settings?.publicPrimaryColor || '#1E40AF';
  const secondaryColor = settings?.publicSecondaryColor || '#10B981';
  const accentColor = settings?.publicAccentColor || '#F59E0B';

  // About Section customizable data
  const aboutHeadline = settings?.aboutTitle || "A Breakthrough in Professional Education";
  const aboutDesc = settings?.portalAboutUs || "Our training programs do not just stop inside clean laboratories or classroom lectures. We bridge the critical gap between raw academic curricula and genuine practical skills demanded in contemporary corporate settings.";
  const aboutImage = settings?.aboutImageUrl || "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?q=80&w=800&auto=format&fit=crop";

  // Color theme state
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    return localStorage.getItem('theme') === 'dark';
  });

  // Toggle theme utility
  const toggleTheme = () => {
    setIsDarkMode(prev => {
      const next = !prev;
      localStorage.setItem('theme', next ? 'dark' : 'light');
      return next;
    });
  };

  // Distance helper function using Haversine formula
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // distance in km
  };

  // GPS Calibration State
  const [gpsState, setGpsState] = useState<'idle' | 'networks' | 'satellites' | 'bearing' | 'calibrated' | 'error'>('idle');
  const [gpsProgress, setGpsProgress] = useState(0);
  const [gpsErrorMessage, setGpsErrorMessage] = useState('');
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [campusDistances, setCampusDistances] = useState<{ kiganjo: number | null }>({ kiganjo: null });

  const startGpsCalibration = () => {
    setGpsState('networks');
    setGpsProgress(20);
    setGpsErrorMessage('');
    
    setTimeout(() => {
      setGpsState('satellites');
      setGpsProgress(55);
      
      setTimeout(() => {
        if (!navigator.geolocation) {
          setGpsState('error');
          setGpsErrorMessage('GPS/Geolocation features are not supported by your browser.');
          return;
        }

        navigator.geolocation.getCurrentPosition(
          (position) => {
            const { latitude, longitude, accuracy } = position.coords;
            setUserLocation({ lat: latitude, lng: longitude, accuracy });
            
            // Calculate distance to Thika Kiganjo campus
            const dKiganjo = calculateDistance(latitude, longitude, -1.04543, 37.0853);
            setCampusDistances({ kiganjo: dKiganjo });

            setGpsState('bearing');
            setGpsProgress(85);

            setTimeout(() => {
              setGpsState('calibrated');
              setGpsProgress(100);
            }, 1000);
          },
          (err) => {
            console.warn("Geolocation fallback activated", err);
            // Fallback user coords in Thika center for demo accuracy
            const fallbackLat = -1.0381;
            const fallbackLng = 37.0583;
            setUserLocation({ lat: fallbackLat, lng: fallbackLng, accuracy: 25 });
            
            const dKiganjo = calculateDistance(fallbackLat, fallbackLng, -1.04543, 37.0853);
            setCampusDistances({ kiganjo: dKiganjo });

            setGpsState('bearing');
            setGpsProgress(85);

            setTimeout(() => {
              setGpsState('calibrated');
              setGpsProgress(100);
            }, 1000);
          },
          { enableHighAccuracy: true, timeout: 6000 }
        );
      }, 1000);
    }, 1000);
  };

  // Nav mobile drawer state
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'cosmetology' | 'ict' | 'healthcare' | 'hospitality' | 'engineering' | 'theology'>('all');

  // Multi-mode Form State (general inquiry or online enrollment application)
  const [formType, setFormType] = useState<'inquiry' | 'apply'>('inquiry');
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    subject: 'Inquiry on Training Services',
    courseInterest: '',
    message: '',
    // Additional application fields
    gender: 'Male',
    dateOfBirth: '',
    prevSchool: '',
    guardianName: '',
    guardianPhone: '',
    address: 'Thika',
    intakePeriod: 'September 2026 Intake'
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Lightbox index state for Gallery
  const [openLightboxIndex, setOpenLightboxIndex] = useState<number | null>(null);

  // Auto scroll utility for quick application fill
  const handleQuickApply = (courseName: string) => {
    setFormType('apply');
    setFormData(prev => ({
      ...prev,
      courseInterest: courseName,
      subject: `Admissions Application: ${courseName}`
    }));
    const contactSection = document.getElementById('contact-element');
    if (contactSection) {
      contactSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Form submit handler writing into secure public firebase collections (admissions path mapped in Rules!)
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSubmitSuccess(false);

    if (!formData.fullName.trim() || !formData.email.trim() || !formData.phone.trim()) {
      setFormError('Please fill in your Full Name, Email Address, and Mobile Contact.');
      return;
    }

    try {
      setIsSubmitting(true);
      
      // Save directly to 'admissions' collection which is already open-create enabled in firestore.rules
      const submissionPayload = {
        ...formData,
        formCategory: formType, // 'inquiry' | 'apply'
        applicantName: formData.fullName,
        applicantEmail: formData.email,
        applicantPhone: formData.phone,
        status: 'pending_review',
        classification: 'public_portal_lead',
        createdAt: new Date().toISOString(),
        academicYear: '2026',
        submittedAt: new Date().toISOString()
      };

      await addDoc(collection(db, 'admissions'), submissionPayload);
      
      setSubmitSuccess(true);
      // Reset critical fields but keep names
      setFormData(prev => ({
        ...prev,
        fullName: '',
        email: '',
        phone: '',
        message: '',
        prevSchool: '',
        guardianName: '',
        guardianPhone: ''
      }));
    } catch (err: any) {
      console.error('Error submitting form to firestore admissions:', err);
      setFormError('An error occurred while submitting your files. Please try again or reach out on WhatsApp.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter courses handler
  const filteredCourses = COURSES.filter(course => {
    const matchesCategory = selectedCategory === 'all' || course.category === selectedCategory;
    const matchesSearch = course.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          course.skills.some(skill => skill.toLowerCase().includes(searchQuery.toLowerCase())) ||
                          course.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Map category helper for visual badge colors
  const getCategoryColor = (cat: string) => {
    switch (cat) {
      case 'cosmetology': return 'bg-pink-100 text-pink-700 dark:bg-pink-950/40 dark:text-pink-400';
      case 'ict': return 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400';
      case 'healthcare': return 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400';
      case 'hospitality': return 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400';
      case 'engineering': return 'bg-teal-100 text-teal-700 dark:bg-teal-950/40 dark:text-teal-400';
      case 'theology': return 'bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-400';
      default: return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
    }
  };

  // Lightbox traversal controls
  const handlePrevLightBox = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (openLightboxIndex !== null) {
      setOpenLightboxIndex(prev => (prev === 0 ? activeGalleryImgs.length - 1 : (prev || 0) - 1));
    }
  };

  const handleNextLightBox = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (openLightboxIndex !== null) {
      setOpenLightboxIndex(prev => (prev === activeGalleryImgs.length - 1 ? 0 : (prev || 0) + 1));
    }
  };

  return (
    <div className={`min-h-screen font-sans antialiased text-slate-800 dark:text-slate-100 transition-colors duration-300 ${isDarkMode ? 'dark bg-slate-950' : 'bg-[#F8FAFC]'} public-portal-wrapper`}>
      <style>{`
        .public-portal-wrapper {
          --color-blue-500: ${primaryColor}cc !important;
          --color-blue-600: ${primaryColor} !important;
          --color-blue-700: ${primaryColor}dd !important;
          --color-blue-800: ${primaryColor}ee !important;
          --color-emerald-500: ${secondaryColor} !important;
          --color-emerald-600: ${secondaryColor}ee !important;
          --color-emerald-550: ${secondaryColor} !important;
          --color-yellow-500: ${accentColor} !important;
          --color-amber-500: ${accentColor} !important;
          --color-accent: ${accentColor} !important;
        }
        .public-portal-wrapper .bg-blue-600, 
        .public-portal-wrapper .bg-blue-700 {
          background-color: ${primaryColor} !important;
        }
        .public-portal-wrapper .text-blue-600,
        .public-portal-wrapper .text-blue-700,
        .public-portal-wrapper .text-blue-900 {
          color: ${primaryColor} !important;
        }
        .public-portal-wrapper .hover\\:text-blue-600:hover {
          color: ${primaryColor} !important;
        }
        .public-portal-wrapper .hover\\:bg-blue-600:hover,
        .public-portal-wrapper .hover\\:bg-blue-700:hover {
          background-color: ${primaryColor}dd !important;
        }
        .public-portal-wrapper .from-blue-600,
        .public-portal-wrapper .from-blue-700 {
          --tw-gradient-from: ${primaryColor} var(--tw-gradient-from-position) !important;
          --tw-gradient-stops: var(--tw-gradient-from), var(--tw-gradient-to, ${primaryColor}55) var(--tw-gradient-stops-position) !important;
        }
        .public-portal-wrapper .to-blue-600,
        .public-portal-wrapper .to-blue-700 {
          --tw-gradient-to: ${primaryColor}dd var(--tw-gradient-to-position) !important;
        }
        .public-portal-wrapper .border-blue-600,
        .public-portal-wrapper .border-blue-200 {
          border-color: ${primaryColor}40 !important;
        }
        .public-portal-wrapper .bg-blue-50 {
          background-color: ${primaryColor}15 !important;
        }
        .public-portal-wrapper .text-emerald-600,
        .public-portal-wrapper .text-emerald-700 {
          color: ${secondaryColor} !important;
        }
        .public-portal-wrapper .bg-emerald-550,
        .public-portal-wrapper .bg-emerald-500,
        .public-portal-wrapper .bg-emerald-600 {
          background-color: ${secondaryColor} !important;
        }
        .font-poppins {
          font-family: 'Poppins', sans-serif !important;
        }
        .font-montserrat {
          font-family: 'Montserrat', sans-serif !important;
        }
        .font-space-grotesk {
          font-family: 'Space Grotesk', sans-serif !important;
        }
      `}</style>
      
      {/* ─────────────────────────────────────────────────────────────────
          1. HEADER / NAVIGATION (W/ DARK SWITCHER & MOBILE BURGER DRAWER)
          ───────────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-white/80 dark:bg-slate-900/80 border-b border-slate-200/50 dark:border-slate-850/50 shadow-sm transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          
          {/* Brand Logo */}
          <div className="flex items-center gap-3">
            {settings?.publicLogoUrl || settings?.logoUrl ? (
              <img
                src={settings?.publicLogoUrl || settings?.logoUrl}
                alt={settings?.appTitle || "School Logo"}
                className="h-10 sm:h-12 w-auto object-contain max-w-[120px] rounded"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/20 font-heading font-black tracking-tighter text-base sm:text-lg">
                {settings?.appTitle || 'BITC'}
              </div>
            )}
            <div>
              <span className="block font-heading font-black text-xs sm:text-sm tracking-tight text-blue-900 dark:text-white leading-tight uppercase font-heading">
                {settings?.schoolName || 'Breakthrough'}
              </span>
              <span className="block text-[9px] sm:text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest font-alt">
                {settings?.appTitle ? `${settings.appTitle} College` : 'International Training College'}
              </span>
            </div>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-8 font-alt text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
            <a href="#about" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">About Us</a>
            <a href="#programs" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Programs</a>
            <a href="#statistics" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Statistics</a>
            <a href="#testimonials" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Testimonials</a>
            <a href="#gallery" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Campus Gallery</a>
            <a href="#contact" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Contact</a>
          </nav>

          {/* Call To Actions */}
          <div className="hidden sm:flex items-center gap-4">
            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-yellow-400 hover:scale-105 active:scale-95 transition-all shadow-sm border border-slate-200/20"
              aria-label="Toggle visual theme colors"
            >
              {isDarkMode ? <Sun size={17} /> : <Moon size={17} />}
            </button>

            {/* Portal Redirect */}
            <Link
              to={isAuthReady && user ? "/dashboard" : "/auth"}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-700 to-blue-600 hover:from-blue-800 hover:to-blue-700 text-white text-xs font-bold font-alt tracking-wider uppercase shadow-md shadow-blue-500/10 hover:shadow-lg transition-all flex items-center gap-2"
            >
              <GraduationCap size={15} />
              <span>Student Portal Login</span>
            </Link>
          </div>

          {/* Tablet/Mobile Actions Right */}
          <div className="flex items-center gap-2 sm:gap-3 lg:hidden">
            <Link
              to={isAuthReady && user ? "/dashboard" : "/auth"}
              className="sm:hidden px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-blue-700 to-blue-600 hover:from-blue-800 hover:to-blue-700 text-white text-[10px] font-black font-alt tracking-wider uppercase shadow-sm flex items-center gap-1 transition-all active:scale-95"
            >
              <GraduationCap size={13} />
              <span>Login</span>
            </Link>

            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-yellow-400 sm:hidden"
            >
              {isDarkMode ? <Sun size={15} /> : <Moon size={15} />}
            </button>

            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-705 dark:text-slate-205 focus:outline-none"
            >
              <Menu size={20} />
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="lg:hidden border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden"
            >
              <div className="px-5 py-6 space-y-4 flex flex-col font-alt text-[11px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">
                <a href="#about" onClick={() => setIsMobileMenuOpen(false)} className="hover:text-blue-600 dark:hover:text-blue-400 py-1 border-b border-slate-100 dark:border-slate-800">About Us</a>
                <a href="#programs" onClick={() => setIsMobileMenuOpen(false)} className="hover:text-blue-600 dark:hover:text-blue-400 py-1 border-b border-slate-100 dark:border-slate-800">Programs</a>
                <a href="#statistics" onClick={() => setIsMobileMenuOpen(false)} className="hover:text-blue-600 dark:hover:text-blue-400 py-1 border-b border-slate-100 dark:border-slate-800">Statistics</a>
                <a href="#testimonials" onClick={() => setIsMobileMenuOpen(false)} className="hover:text-blue-600 dark:hover:text-blue-400 py-1 border-b border-slate-100 dark:border-slate-800">Testimonials</a>
                <a href="#gallery" onClick={() => setIsMobileMenuOpen(false)} className="hover:text-blue-600 dark:hover:text-blue-400 py-1 border-b border-slate-100 dark:border-slate-800">Campus Gallery</a>
                <a href="#contact" onClick={() => setIsMobileMenuOpen(false)} className="hover:text-blue-600 dark:hover:text-blue-400 py-1 block">Contact</a>
                
                <div className="pt-2 flex flex-col gap-3">
                  <Link
                    to="/auth"
                    className="w-full py-3 rounded-lg text-center bg-blue-600 text-white font-bold"
                  >
                    Student Portal
                  </Link>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* ─────────────────────────────────────────────────────────────────
          2. HERO SECTION (HIGH CONVERTING GRID ACCENTED WITH BG CAROUSEL)
          ───────────────────────────────────────────────────────────────── */}
      <section id="hero" className="relative py-16 lg:py-24 overflow-hidden border-b border-slate-100 dark:border-slate-900 bg-gradient-to-b from-blue-50/20 via-slate-50 to-[#F8FAFC] dark:from-slate-900/40 dark:via-slate-950 dark:to-slate-950">
        
        {/* Background Decorative Blur Orbs */}
        <div className="absolute top-20 left-10 w-72 h-72 bg-blue-300/10 dark:bg-blue-600/5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-10 right-10 w-96 h-96 bg-emerald-300/10 dark:bg-emerald-600/5 rounded-full blur-3xl"></div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid lg:grid-cols-12 gap-12 lg:gap-8 items-center">
            
            {/* Left Column Content */}
            <div className={`lg:col-span-7 flex flex-col gap-6 ${alignClass}`}>
              
              <div className={`inline-flex ${selfAlignClass} items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 dark:bg-blue-950/40 border border-blue-200/30 dark:border-blue-800/20 text-[10px] sm:text-xs font-bold uppercase tracking-widest text-blue-700 dark:text-blue-400 font-alt`}>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-555 animate-ping"></span>
                <span>Admissions Ongoing - September 2026 Intake</span>
              </div>

              <h1 className={`${titleFontFamily} ${titleWeightClass} ${titleItalicClass} ${titleSizeClass} ${titleAlignClass} text-slate-900 dark:text-white leading-[1.1] tracking-tight`}>
                {portalTitle}
              </h1>

              <p className={`${descFontFamily} ${descWeightClass} ${descItalicClass} ${descSizeClass} ${descAlignClass} leading-relaxed text-slate-655 dark:text-slate-355 max-w-xl font-medium`}>
                {portalDescription}
              </p>

              <div className={`flex flex-col sm:flex-row items-center gap-4 pt-2 ${buttonsAlignClass}`}>
                <a
                  href="#contact"
                  onClick={() => setFormType('apply')}
                  className="w-full sm:w-auto px-8 py-4 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-805 text-white font-black font-alt text-xs uppercase tracking-wider shadow-lg shadow-blue-500/20 active:scale-95 hover:scale-105 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <FileCheck2 size={16} />
                  <span>Apply Online Now</span>
                </a>
                
                <a
                  href="#programs"
                  className="w-full sm:w-auto px-8 py-4 rounded-xl bg-white dark:bg-slate-90 px-8 py-4 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-bold font-alt text-xs uppercase tracking-wider hover:bg-slate-50 dark:hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
                >
                  <span>Explore Courses</span>
                  <ArrowRight size={15} className="text-blue-600" />
                </a>
              </div>

              {/* Accreditations Row */}
              <div className="pt-6 border-t border-slate-200/50 dark:border-slate-850/50 w-full">
                <p className={`text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 font-alt tracking-widest ${titleAlignClass} mb-3`}>
                  Our Training & Exam Boards Accreditations
                </p>
                <div className={`flex flex-wrap gap-3 ${settings?.publicHeroAlign === 'center' ? 'justify-center' : settings?.publicHeroAlign === 'right' ? 'justify-end' : 'justify-start'}`}>
                  <span className="px-3 py-1 bg-white dark:bg-slate-900/60 rounded-lg text-[10px] font-extrabold text-slate-600 dark:text-slate-400 border border-slate-100 dark:border-slate-800 shadow-sm">NITA Accredited</span>
                  <span className="px-3 py-1 bg-white dark:bg-slate-900/60 rounded-lg text-[10px] font-extrabold text-slate-600 dark:text-slate-400 border border-slate-100 dark:border-slate-800 shadow-sm">KNEC Registered</span>
                  <span className="px-3 py-1 bg-white dark:bg-slate-900/60 rounded-lg text-[10px] font-extrabold text-slate-600 dark:text-slate-400 border border-slate-100 dark:border-slate-800 shadow-sm">TVET CDACC Certified</span>
                </div>
              </div>

            </div>

            {/* Right Column Visual Image (With Glassmorphism Overlay Cards) */}
            <div className="lg:col-span-5 relative mt-6 lg:mt-0">
              <div className="relative mx-auto max-w-md w-full aspect-[4/5] rounded-3xl overflow-hidden shadow-2xl border-4 border-white dark:border-slate-900 bg-slate-205">
                <img
                  src={heroImage}
                  alt="BITC Students Practice"
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
                
                {/* Gradient shade overlays */}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 via-transparent to-transparent"></div>

                {/* Glassmorphism Dynamic Overlay Card 1: Experience */}
                <div className="absolute bottom-6 left-6 right-6 backdrop-blur-md bg-white/70 dark:bg-slate-900/70 py-4 px-5 rounded-2xl border border-white/20 dark:border-slate-800/30 flex items-center gap-4 shadow-xl">
                  <div className="h-10 w-10 shrink-0 rounded-xl bg-emerald-500 text-white flex items-center justify-center text-lg">
                    💎
                  </div>
                  <div>
                    <p className="text-[11px] font-extrabold text-emerald-700 dark:text-emerald-400 uppercase tracking-widest font-alt">Practical Education</p>
                    <p className="text-xs font-bold text-slate-900 dark:text-white leading-tight mt-0.5">80% Hands-On Practical Training</p>
                  </div>
                </div>

                {/* Glassmorphism Dynamic Overlay Card 2: Intake */}
                <div className="absolute top-6 right-6 backdrop-blur-md bg-blue-900/80 text-white px-4 py-3 rounded-2xl border border-blue-500/20 flex flex-col items-center gap-0.5 shadow-lg">
                  <span className="text-[9px] font-black uppercase tracking-widest font-alt text-blue-200">APPLY FOR</span>
                  <span className="text-sm font-black tracking-tight leading-none uppercase font-heading">SEPT 2026</span>
                  <span className="text-[9px] font-semibold text-emerald-400 leading-none mt-0.5">INTAKE ONGOING</span>
                </div>

              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────
          3. ABOUT US SECTION (STORY, MISSION & VISION WITH THEME BORDERS)
          ───────────────────────────────────────────────────────────────── */}
      <section id="about" className="py-20 bg-white dark:bg-slate-950 transition-colors border-b border-slate-100 dark:border-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          {/* Section title */}
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-xs font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400 font-alt block mb-2">Our Foundation</span>
            <h2 className="text-3xl sm:text-4xl font-heading font-black text-slate-900 dark:text-white tracking-tight">
              Breakthrough International Training College
            </h2>
            <div className="w-16 h-1 rounded-full bg-blue-600 mx-auto mt-4"></div>
          </div>

          <div className="grid md:grid-cols-2 gap-12 items-center">
            
            {/* Story side */}
            <div className="space-y-6">
              <h3 className="text-xl font-heading font-extrabold text-blue-900 dark:text-blue-400 leading-snug">
                Pioneering Professional Training with Integrity and Job Integrity Outcomes in Thika, Kenya
              </h3>
              
              <p className="text-sm text-slate-655 dark:text-slate-355 leading-relaxed">
                Breakthrough International Training College is a leading technical training institute headquartered in Thika. We deliver specialized professional curricula aimed at empowering youth, enhancing skill sets, and preparing professionals for high-demand jobs both locally and internationally.
              </p>

              <blockquote className="p-4 bg-slate-50 dark:bg-slate-900/60 rounded-r-xl border-l-4 border-blue-600 text-xs italic text-slate-600 dark:text-slate-300 font-medium">
                "Our training programs do not just stop inside clean laboratories or classroom lectures. We bridge the critical gap between raw academic curricula and genuine practical skills demanded in contemporary corporate settings."
              </blockquote>

              <p className="text-sm text-slate-655 dark:text-slate-355 leading-relaxed">
                Whether you prefer building responsive web systems in ICT, managing patient care in healthcare facilities, designing sweet pastries in baking/catering, or operating architectural wiring diagnostics, you are assured of premier instructional models.
              </p>
            </div>

            {/* Mission & Vision cards */}
            <div className="grid gap-6">
              
              {/* Mission Card */}
              <div className="p-8 rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100/50 dark:from-slate-900/30 dark:to-slate-900/10 border border-slate-120 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
                <div className="h-12 w-12 rounded-xl bg-blue-100 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center text-xl font-black mb-5">
                  🎯
                </div>
                <h4 className="text-base font-heading font-extrabold text-slate-900 dark:text-white mb-2 uppercase tracking-wide">
                  Our Educational Mission
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  To provide breakthrough, hands-on, internationally recognized technical training programs that impart students with state-of-the-art career competence, self-reliance, and impeccable job market professionalism.
                </p>
              </div>

              {/* Vision Card */}
              <div className="p-8 rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100/50 dark:from-slate-900/30 dark:to-slate-900/10 border border-slate-120 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
                <div className="h-12 w-12 rounded-xl bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-xl font-black mb-5">
                  🔮
                </div>
                <h4 className="text-base font-heading font-extrabold text-slate-900 dark:text-white mb-2 uppercase tracking-wide">
                  Our Corporate Vision
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  To remain the most recognized, preferred center of excellence in healthcare caregiving, ICT software development, advanced cosmetology, culinary technology, and electrical systems in the East African region.
                </p>
              </div>

            </div>

          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────
          4. SERVICES/PROGRAMS SECTION WITH INSTANT SEARCH & DYNAMIC FILTER
          ───────────────────────────────────────────────────────────────── */}
      <section id="programs" className="py-20 bg-slate-50 dark:bg-slate-900/30 transition-colors border-b border-slate-100 dark:border-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          {/* Section banner */}
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-xs font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400 font-alt block mb-2">Programs Catalog</span>
            <h2 className="text-3xl font-heading font-black text-slate-900 dark:text-white tracking-tight">
              Specialized Schools & Professional Courses
            </h2>
            <p className="text-xs text-slate-605 dark:text-slate-400 mt-2 font-medium">
              We offer both diploma and certificate programs accredited for global jobs placement.
            </p>
          </div>

          {/* Search bar & Categories filter grid */}
          <div className="max-w-4xl mx-auto mb-10 flex flex-col gap-5 items-center">
            
            {/* Realtime Search Input */}
            <div className="relative w-full max-w-xl">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={18} />
              <input
                type="text"
                placeholder="Search by course name, skills (e.g. makeup, coding, nursing, solar)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-11 pr-5 py-3.5 rounded-2xl bg-white dark:bg-slate-900 text-sm border border-slate-205 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm transition-all text-slate-900 dark:text-white"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-650 bg-slate-100 dark:bg-slate-800 rounded-full"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Filter buttons row */}
            <div className="flex flex-wrap items-center justify-center gap-2">
              {[
                { id: 'all', label: 'All Schools' },
                { id: 'cosmetology', label: 'Cosmetology' },
                { id: 'ict', label: 'ICT & Software' },
                { id: 'healthcare', label: 'Caregiver Health' },
                { id: 'hospitality', label: 'Culinary Art' },
                { id: 'engineering', label: 'Electrical Tech' },
                { id: 'theology', label: 'Theological Studies' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setSelectedCategory(tab.id as any)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                    selectedCategory === tab.id
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-500/10'
                      : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

          </div>

          {/* Dynamic Grid Results */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
            <AnimatePresence mode="popLayout">
              {filteredCourses.map((course) => {
                // Determine appropriate card icon based on category
                let CatIcon = BookOpen;
                if (course.category === 'cosmetology') CatIcon = Scissors;
                if (course.category === 'ict') CatIcon = Cpu;
                if (course.category === 'healthcare') CatIcon = Heart;
                if (course.category === 'hospitality') CatIcon = Coffee;
                if (course.category === 'engineering') CatIcon = Plug;
                if (course.category === 'theology') CatIcon = GraduationCap;

                return (
                  <motion.div
                    key={course.id}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="group flex flex-col justify-between bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/50 dark:border-slate-850/50 hover:border-slate-300 dark:hover:border-slate-700 shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden relative"
                  >
                    {/* Glassmorphic card header */}
                    <div className="p-6 pb-2">
                      <div className="flex items-center justify-between mb-4">
                        <div className={`p-3 rounded-xl bg-slate-50 dark:bg-slate-800 text-blue-600 dark:text-blue-400 group-hover:scale-110 group-hover:bg-blue-600 group-hover:text-white transition-all`}>
                          <CatIcon size={20} />
                        </div>
                        <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${getCategoryColor(course.category)}`}>
                          {course.category}
                        </span>
                      </div>

                      <h3 className="font-heading font-black text-slate-900 dark:text-white text-base leading-snug group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {course.name}
                      </h3>

                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mt-2">
                        {course.description}
                      </p>
                    </div>

                    {/* Meta info block */}
                    <div className="p-6 pt-2 space-y-4">
                      
                      {/* Course Core parameters */}
                      <div className="space-y-2 text-[10px] sm:text-xs">
                        
                        <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 flex justify-between">
                          <span className="text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Duration:</span>
                          <span className="text-slate-900 dark:text-slate-200 font-black flex items-center gap-1">
                            <Clock size={12} className="text-emerald-555" />
                            {course.duration}
                          </span>
                        </div>

                        <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 flex flex-col gap-1 text-left">
                          <span className="text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Requirements:</span>
                          <span className="text-slate-900 dark:text-slate-200 font-medium">{course.requirements}</span>
                        </div>

                        <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 flex justify-between">
                          <span className="text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Exams Body:</span>
                          <span className="text-slate-900 dark:text-slate-200 font-black">{course.exams}</span>
                        </div>

                      </div>

                      {/* Skills taught */}
                      <div className="pt-2">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Target Skills taught:</p>
                        <div className="flex flex-wrap gap-1.5">
                          {course.skills.map((skill, index) => (
                            <span key={index} className="text-[9px] font-bold px-2 py-0.5 bg-slate-100 dark:bg-slate-800/40 text-slate-600 dark:text-slate-400 rounded-md">
                              {skill}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* CTA inside card */}
                      <button
                        onClick={() => handleQuickApply(course.name)}
                        className="w-full py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-blue-600 dark:hover:bg-blue-600 hover:text-white dark:hover:text-white text-blue-650 dark:text-blue-400 font-bold text-xs font-alt uppercase tracking-widest transition-all shadow-sm border border-slate-200/10 active:scale-95 flex items-center justify-center gap-2"
                      >
                        <BookmarkCheck size={14} />
                        <span>Enquire & Enroll</span>
                      </button>

                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {/* Empty Search Fallback */}
            {filteredCourses.length === 0 && (
              <div className="col-span-full py-12 text-center flex flex-col items-center gap-4 bg-white dark:bg-slate-900 rounded-3xl p-8 border border-dashed border-slate-200">
                <span className="text-4xl text-slate-400">🔍</span>
                <p className="font-heading font-extrabold text-slate-900 dark:text-white">No courses matched your search</p>
                <p className="text-xs text-slate-500 max-w-md">
                  We could not find active courses matching "{searchQuery}". Please try adjusting your filters or typing other keywords.
                </p>
                <button
                  onClick={() => { setSearchQuery(''); setSelectedCategory('all'); }}
                  className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl"
                >
                  Reset Course Filters
                </button>
              </div>
            )}
          </div>

        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────
          5. STATISTICS BREAKDOWN (STUDENTS, GRADUATES, STAFF, CAMPUSES)
          ───────────────────────────────────────────────────────────────── */}
      <section id="statistics" className="py-16 bg-gradient-to-r from-blue-900 via-blue-950 to-indigo-950 text-white relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 font-alt block mb-2">Institutional Numbers</span>
            <h2 className="text-3xl font-heading font-black text-white tracking-tight">
              Breakthrough By the Numbers
            </h2>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            
            {/* Stat item 1 */}
            <div className="text-center space-y-2 border-r border-white/10 last:border-0 p-4">
              <div className="text-3xl sm:text-4xl lg:text-5xl font-heading font-black text-emerald-400 tracking-tight">
                200+
              </div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-300 font-alt">
                Active Enrolled Students
              </p>
              <p className="text-[10px] text-slate-400">
                Across both physical learning campuses
              </p>
            </div>

            {/* Stat item 2 */}
            <div className="text-center space-y-2 border-r border-white/10 last:border-0 p-4">
              <div className="text-3xl sm:text-4xl lg:text-5xl font-heading font-black text-white tracking-tight">
                200+
              </div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-300 font-alt">
                Certified Graduates
              </p>
              <p className="text-[10px] text-slate-400 font-mono">
                Working in corporate healthcare & ICT industry
              </p>
            </div>

            {/* Stat item 3 */}
            <div className="text-center space-y-2 border-r border-white/10 last:border-0 p-4">
              <div className="text-3xl sm:text-4xl lg:text-5xl font-heading font-black text-emerald-400 tracking-tight">
                5+
              </div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-300 font-alt">
                Instructors & Specialists
              </p>
              <p className="text-[10px] text-slate-400">
                Dedicated corporate industry professionals
              </p>
            </div>

            {/* Stat item 4 */}
            <div className="text-center space-y-2 border-r border-white/10 last:border-0 p-4">
              <div className="text-3xl sm:text-4xl lg:text-5xl font-heading font-black text-white tracking-tight">
                1
              </div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-300 font-alt">
                Physical Campuses
              </p>
              <p className="text-[10px] text-slate-400">
                Located in Thika Kiganjo, Corner 2
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────
          6. TESTIMONIALS SLIDER SECTION
          ───────────────────────────────────────────────────────────────── */}
      <section id="testimonials" className="py-20 bg-white dark:bg-slate-950 transition-colors border-b border-slate-100 dark:border-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto mb-12">
            <span className="text-xs font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400 font-alt block mb-2">Student Stories</span>
            <h2 className="text-3xl font-heading font-black text-slate-900 dark:text-white tracking-tight">
              What Our Alumni Say
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {TESTIMONIALS.map((test, index) => (
              <div
                key={index}
                className="p-8 rounded-3xl bg-[#F8FAFC] dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col justify-between"
              >
                <div>
                  {/* Rating stars */}
                  <div className="flex items-center gap-1 text-amber-500 mb-5">
                    {[...Array(test.rating)].map((_, i) => (
                      <Star key={i} size={15} fill="currentColor" />
                    ))}
                  </div>

                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed italic">
                    "{test.quote}"
                  </p>
                </div>

                <div className="pt-6 border-t border-slate-200/50 dark:border-slate-800/50 mt-6 flex items-center gap-4">
                  <span className="text-3xl p-1.5 rounded-full bg-slate-100 dark:bg-slate-800">
                    {test.avatar}
                  </span>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase font-alt">
                      {test.name}
                    </h4>
                    <p className="text-[10px] text-slate-400">
                      {test.role} at <strong className="text-slate-500">{test.workplace}</strong>
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────
          7. CAMPUS EXPERIENCE GALLERY SECTION & IMMERSIVE LIGHTBOX
          ───────────────────────────────────────────────────────────────── */}
      <section id="gallery" className="py-20 bg-slate-50 dark:bg-slate-900/30 transition-colors border-b border-slate-100 dark:border-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto mb-12">
            <span className="text-xs font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400 font-alt block mb-2">Visual Campus Tour</span>
            <h2 className="text-3xl font-heading font-black text-slate-900 dark:text-white tracking-tight">
              Life and Practical Training at BITC
            </h2>
            <p className="text-xs text-slate-505 dark:text-slate-400 mt-2 font-medium">
              Click any image to view it full screen inside our immersive Lightbox gallery module.
            </p>
          </div>

          {/* Grid Layout of photos */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {activeGalleryImgs.map((img, i) => (
              <div
                key={i}
                onClick={() => setOpenLightboxIndex(i)}
                className="group relative rounded-2xl aspect-video overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm cursor-pointer hover:scale-[1.03] hover:shadow-lg transition-all duration-300"
              >
                <img
                  src={img.url}
                  alt={img.title}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  referrerPolicy="no-referrer"
                />
                
                {/* Visual hover caption drawer */}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-5">
                  <span className="text-[9px] font-black uppercase tracking-widest text-emerald-400 font-alt">
                    {img.category}
                  </span>
                  <p className="text-xs font-black text-white leading-tight mt-1 truncate">
                    {img.title}
                  </p>
                </div>
              </div>
            ))}
          </div>

        </div>

        {/* ── IMMERSIVE LIGHTBOX VIEWPORT DIALOG ── */}
        <AnimatePresence>
          {openLightboxIndex !== null && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-slate-950/95 flex flex-col items-center justify-center p-4 backdrop-blur-md"
              onClick={() => setOpenLightboxIndex(null)}
            >
              
              {/* Close Button */}
              <button
                onClick={() => setOpenLightboxIndex(null)}
                className="absolute top-6 right-6 p-3 rounded-full bg-white/10 text-white hover:bg-white/20 hover:scale-105 active:scale-95 transition-all outline-none"
              >
                <X size={20} />
              </button>

              {/* Traversals Elements */}
              <div className="relative max-w-4xl w-full aspect-video flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
                
                {/* Previous */}
                <button
                  onClick={handlePrevLightBox}
                  className="absolute left-4 p-3 rounded-full bg-slate-900/85 hover:bg-slate-800 text-white outline-none hover:scale-105 transition-all z-10"
                >
                  <ChevronLeft size={20} />
                </button>

                {/* Main Expanded Image */}
                <img
                  src={activeGalleryImgs[openLightboxIndex].url}
                  alt={activeGalleryImgs[openLightboxIndex].title}
                  className="max-h-[80vh] max-w-full rounded-2xl object-contain border border-white/10"
                  referrerPolicy="no-referrer"
                />

                {/* Next */}
                <button
                  onClick={handleNextLightBox}
                  className="absolute right-4 p-3 rounded-full bg-slate-900/85 hover:bg-slate-800 text-white outline-none hover:scale-105 transition-all z-10"
                >
                  <ChevronRight size={20} />
                </button>

              </div>

              {/* Lightbox Caption */}
              <div className="text-center mt-4 text-white max-w-xl px-4" onClick={(e) => e.stopPropagation()}>
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 font-alt">
                  {activeGalleryImgs[openLightboxIndex].category}
                </span>
                <p className="text-sm font-bold mt-1">
                  {activeGalleryImgs[openLightboxIndex].title}
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Image {openLightboxIndex + 1} of {activeGalleryImgs.length}
                </p>
              </div>

            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* ─────────────────────────────────────────────────────────────────
          8. CONTACT SECTION (MOCK MAP, TOGGLABLE FORM TO FIRESTORE)
          ───────────────────────────────────────────────────────────────── */}
      <section id="contact" className="py-20 bg-white dark:bg-slate-950 transition-colors">
        <div id="contact-element" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-xs font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400 font-alt block mb-2">Connect With Us</span>
            <h2 className="text-3xl font-heading font-black text-slate-900 dark:text-white tracking-tight">
              Submit Inquiry or Enroll Online
            </h2>
            <span className="w-16 h-1 rounded-full bg-blue-600 mx-auto mt-4 block"></span>
          </div>

          <div className="grid lg:grid-cols-12 gap-12 items-start">
            
            {/* Left Column Address Info & Mock Interactive Visual Map */}
            <div className="lg:col-span-5 space-y-8">
              
              <div className="space-y-4">
                <h3 className="text-lg font-heading font-extrabold text-slate-900 dark:text-white uppercase tracking-wide">
                  Breakthrough Campus Location
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Our physical learning facility is fully equipped with state-of-the-art computer labs, cosmetology salons, baking ovens, solar panels, and nursing mannequins to deliver top-tier hands-on training.
                </p>
              </div>

              {/* Campus Address Blocks */}
              <div className="space-y-4 text-xs font-medium text-slate-700 dark:text-slate-300">
                
                {/* Campus A */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800 flex gap-4">
                  <MapPin className="shrink-0 text-blue-600" size={18} />
                  <div>
                    <h4 className="font-extrabold text-slate-900 dark:text-white font-alt uppercase tracking-wider text-[11px]">Primary Kiganjo Campus</h4>
                    <p className="text-slate-500 mt-1">{settings?.publicAddress || "Thika Kiganjo, Corner 2, Thika."}</p>
                  </div>
                </div>

                {/* Phone & Mail details */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800 flex flex-col gap-3">
                  <div className="flex gap-4 items-center">
                    <Phone size={15} className="text-blue-600" />
                    <span>0727 114 355 / 0707 760 239</span>
                  </div>
                  <div className="flex gap-4 items-center">
                    <Mail size={15} className="text-blue-600" />
                    <span>{settings?.publicEmail || "info@breakthrough.ac.ke"}</span>
                  </div>
                  <div className="flex gap-4 items-center">
                    <Clock size={15} className="text-blue-600" />
                    <span>Mon - Fri: 8:00 AM to 5:00 PM | Sat: 8:00 AM to 1:00 PM</span>
                  </div>
                </div>

              </div>

              {/* GPS Live Calibration & Campus Routing Assistant */}
              <div className="p-5 rounded-2xl bg-white dark:bg-slate-905 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 relative">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
                    <Compass size={18} className={gpsState !== 'idle' && gpsState !== 'calibrated' && gpsState !== 'error' ? 'animate-spin' : ''} />
                  </div>
                  <div>
                    <h4 className="font-heading font-extrabold text-slate-900 dark:text-white uppercase tracking-wider text-xs">GPS Alignment Tool & Directions</h4>
                    <p className="text-[10px] text-slate-500">Calibrate your live geo-coordinates for direct, high-accuracy campus routes.</p>
                  </div>
                </div>

                {gpsState === 'idle' && (
                  <div className="bg-slate-50 dark:bg-slate-950/30 p-3.5 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center space-y-3">
                    <p className="text-[11px] text-slate-600 dark:text-slate-400">Your current coordinates are not synced with the local Thika transmitter nodes.</p>
                    <button
                      type="button"
                      onClick={startGpsCalibration}
                      className="w-full py-2 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-alt text-xs font-bold uppercase tracking-wider shadow-sm transition-all flex items-center justify-center gap-2 group hover:scale-[1.01] active:scale-95 cursor-pointer border-0"
                    >
                      <Locate size={14} className="group-hover:animate-pulse" />
                      <span>Calibrate Active GPS</span>
                    </button>
                  </div>
                )}

                {(gpsState === 'networks' || gpsState === 'satellites' || gpsState === 'bearing') && (
                  <div className="bg-slate-50 dark:bg-slate-950/30 p-4 rounded-xl border border-slate-100 dark:border-slate-800 space-y-3">
                    <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider">
                      <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                        <Activity size={12} className="animate-pulse" />
                        {gpsState === 'networks' && 'Aligning cell positioning grids...'}
                        {gpsState === 'satellites' && 'Locking onto GPS satellite arrays...'}
                        {gpsState === 'bearing' && 'Calculating compass bearing vectors...'}
                      </span>
                      <span className="text-slate-500 font-mono">{gpsProgress}%</span>
                    </div>
                    {/* Progress Bar Container */}
                    <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                      <div 
                        className="bg-emerald-500 h-full rounded-full transition-all duration-500 ease-out" 
                        style={{ width: `${gpsProgress}%` }}
                      />
                    </div>
                    <p className="text-[9px] text-slate-400 italic text-center">Do not close this application window while alignment resolves.</p>
                  </div>
                )}

                {gpsState === 'calibrated' && (
                  <div className="space-y-3 animate-fadeIn">
                    <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-450 p-3 rounded-xl flex items-start gap-2.5">
                      <CheckCircle2 size={16} className="shrink-0 mt-0.5 text-emerald-500" />
                      <div className="text-[11px]">
                        <span className="font-bold block text-emerald-600 dark:text-emerald-400">GPS Link Calibrated Successfully!</span>
                        <div className="font-mono text-[10px] text-slate-500 dark:text-slate-400 mt-1 space-y-0.5">
                          <p>Lat/Lng: {userLocation?.lat.toFixed(5)}, {userLocation?.lng.toFixed(5)}</p>
                          <p>Signal Accuracy: ±{userLocation?.accuracy || 10} meters</p>
                          <p>Lock Strength: High Precision Channel</p>
                        </div>
                      </div>
                    </div>

                    <div className="w-full text-[10px]">
                      {/* Connection Campus A */}
                      <div className="p-4 bg-slate-50 dark:bg-slate-950/30 border border-slate-100 dark:border-slate-800 rounded-xl space-y-3 flex flex-col justify-between">
                        <div>
                          <span className="font-extrabold uppercase text-slate-850 dark:text-slate-200 tracking-wider block text-[10px] font-alt">Kiganjo Campus</span>
                          <span className="text-[9px] text-slate-400 block mt-0.5">Kiganjo Corner 2, Thika</span>
                        </div>
                        <div className="space-y-1 my-1">
                          <span className="text-slate-500 text-[9px] block">Distance:</span>
                          <span className="font-black text-slate-900 dark:text-white font-mono text-sm">
                            {campusDistances.kiganjo ? `${campusDistances.kiganjo.toFixed(2)} km` : 'Calculating...'}
                          </span>
                        </div>
                        <a
                          href="https://www.google.com/maps/dir/?api=1&destination=-1.04543,37.0853"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-[10px] uppercase tracking-widest text-center flex items-center justify-center gap-1.5 transition-colors border-0"
                        >
                          <Navigation size={12} />
                          <span>Navigate to Campus</span>
                        </a>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={startGpsCalibration}
                      className="w-full py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-transparent hover:bg-slate-50 dark:hover:bg-slate-800/50 text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                    >
                      <RotateCw size={11} />
                      <span>Recalibrate Signal</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Stunning Mock Visual Location Map or Real Google Map Embed */}
              {settings?.publicLocationEmbed ? (
                <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 overflow-hidden relative shadow-lg aspect-video">
                  <iframe
                    src={settings.publicLocationEmbed}
                    width="100%"
                    height="100%"
                    style={{ border: 0 }}
                    allowFullScreen={true}
                    loading="lazy"
                    title="Campus Google Map"
                    referrerPolicy="no-referrer"
                    className="w-full h-full"
                  ></iframe>
                </div>
              ) : (
                <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 overflow-hidden relative shadow-lg aspect-video flex flex-col items-center justify-center p-6 text-center text-xs text-slate-500">
                  <div className="absolute inset-0 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] dark:bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px] opacity-60"></div>
                  <Users size={32} className="text-blue-600 animate-bounce mb-3 relative z-10" />
                  <span className="font-heading font-black text-slate-900 dark:text-white uppercase tracking-wider relative z-10">Thika Town Interactive Map</span>
                  <span className="text-slate-500 mt-1 max-w-xs relative z-10">Located right opposite physical training complex center. Find us opposite Thika Workshop mosque for registration guides.</span>
                  <div className="absolute bottom-3 right-3 px-2 py-1 rounded bg-slate-200 dark:bg-slate-800 text-[10px] font-bold text-slate-600">Map Interface</div>
                </div>
              )}

            </div>

            {/* Right Column Interactive Togglable Form Card */}
            <div className="lg:col-span-7 bg-slate-50 dark:bg-slate-900/40 border border-slate-205/60 dark:border-slate-850/60 rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
              
              {/* Form Category Slider button */}
              <div className="flex justify-center mb-8">
                <div className="bg-slate-200 dark:bg-slate-800 p-1 rounded-2xl flex items-center w-full max-w-sm relative">
                  
                  <button
                    type="button"
                    onClick={() => { setFormType('inquiry'); setSubmitSuccess(false); }}
                    className={`flex-1 py-3 text-center text-xs font-bold uppercase tracking-wider rounded-xl transition-all ${
                      formType === 'inquiry'
                        ? 'bg-blue-600 text-white shadow'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    Quick Inquiry
                  </button>

                  <button
                    type="button"
                    onClick={() => { setFormType('apply'); setSubmitSuccess(false); }}
                    className={`flex-1 py-3 text-center text-xs font-bold uppercase tracking-wider rounded-xl transition-all ${
                      formType === 'apply'
                        ? 'bg-blue-600 text-white shadow'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    Online Enrollment
                  </button>

                </div>
              </div>

              {/* Header inside form */}
              <div className="mb-6">
                <h3 className="font-heading font-black text-lg text-slate-900 dark:text-white uppercase tracking-wide">
                  {formType === 'inquiry' ? 'Ask a Question about our courses' : 'Secure Your September 2026 Spot Online'}
                </h3>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 font-medium">
                  {formType === 'inquiry'
                    ? 'Fill out this brief catalog review and we will email/call you within 24 working hours.'
                    : 'No registration fees payable during this application submission. Fill details to register.'}
                </p>
              </div>

              {/* Error indicator */}
              {formError && (
                <div className="p-4 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 border border-red-200/50 dark:border-red-900/30 rounded-xl text-xs font-bold mb-6 flex gap-2 items-center">
                  <span>⚠️</span>
                  <span>{formError}</span>
                </div>
              )}

              {/* Form fields */}
              <AnimatePresence mode="wait">
                {submitSuccess ? (
                  <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    className="p-8 text-center bg-white dark:bg-slate-900 rounded-3xl border border-emerald-100 dark:border-emerald-950/40 flex flex-col items-center gap-4 shadow shadow-emerald-500/5"
                  >
                    <div className="h-16 w-16 rounded-full bg-emerald-50 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-4xl animate-bounce">
                      <CheckCircle2 size={32} />
                    </div>
                    <p className="font-heading font-black text-slate-900 dark:text-white uppercase tracking-wider">
                      Submission Received Successfully!
                    </p>
                    <p className="text-xs text-slate-500 max-w-sm leading-relaxed">
                      Thank you for connecting with Breakthrough International Training College! Your secure details have been successfully saved in our database. Our admissions department will reach out on phone or email within 24 hours.
                    </p>
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-955/30 px-3 py-1 rounded-lg">
                      Secure ID: {Math.random().toString(36).substring(2, 9).toUpperCase()}
                    </p>
                    <button
                      type="button"
                      onClick={() => setSubmitSuccess(false)}
                      className="px-6 py-2 bg-blue-600 text-white font-bold text-xs rounded-xl"
                    >
                      Reset Form Input
                    </button>
                  </motion.div>
                ) : (
                  <motion.form
                    key={formType}
                    onSubmit={handleFormSubmit}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-4 text-xs font-semibold"
                  >
                    
                    {/* Full Name & Email Input Row */}
                    <div className="grid sm:grid-cols-2 gap-4">
                      
                      <div className="space-y-1">
                        <label className="text-slate-400 dark:text-slate-500 uppercase tracking-widest text-[10px]">What is your Full Name? *</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Gladys Wambui"
                          value={formData.fullName}
                          onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                          className="w-full p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white outline-none focus:border-blue-500"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-slate-400 dark:text-slate-500 uppercase tracking-widest text-[10px]">Your Primary Email Address *</label>
                        <input
                          type="email"
                          required
                          placeholder="g.wambui@company.com"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          className="w-full p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white outline-none focus:border-blue-500"
                        />
                      </div>

                    </div>

                    {/* Mobile contact & Course Selection Row */}
                    <div className="grid sm:grid-cols-2 gap-4">
                      
                      <div className="space-y-1">
                        <label className="text-slate-400 dark:text-slate-500 uppercase tracking-widest text-[10px]">Your Phone / Mobile Number *</label>
                        <input
                          type="tel"
                          required
                          placeholder="e.g. 0722 000 000"
                          value={formData.phone}
                          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                          className="w-full p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white outline-none focus:border-blue-500"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-slate-400 dark:text-slate-500 uppercase tracking-widest text-[10px]">Selecting Course / Program of Interest *</label>
                        <select
                          value={formData.courseInterest}
                          onChange={(e) => setFormData({ ...formData, courseInterest: e.target.value })}
                          className="w-full p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white outline-none focus:border-blue-500"
                        >
                          <option value="">-- Please Select Course --</option>
                          <optgroup label="Cosmetology School">
                            <option value="Diploma in Beauty Therapy, Skincare & Professional Makeup">Diploma in Beauty & Makeup</option>
                            <option value="Certificate in Hairdressing, Advanced Styling & Barbering">Certificate in Hairdressing & Styling</option>
                          </optgroup>
                          <optgroup label="ICT Software School">
                            <option value="Diploma in Software Engineering & Web Development">Diploma in Software Engineering</option>
                            <option value="Certificate in Computer Packages & Digital Commerce Systems">Certificate in Computer Packages</option>
                          </optgroup>
                          <optgroup label="Healthcare Caregiver School">
                            <option value="Certificate in Community Health & Professional Caregiver Studies">Certificate in Caregiver Health</option>
                            <option value="Diploma in Nursing Aide, Anatomy & Patient Nutrition">Diploma in Nursing Aide & Clinic Support</option>
                          </optgroup>
                          <optgroup label="Hospitality School">
                            <option value="Certificate in Professional Cookery, General Baking & Cake Decoration">Certificate in Baking & Cookery</option>
                            <option value="Diploma in Catering & Hospitality Management">Diploma in Hospitality Management</option>
                          </optgroup>
                          <optgroup label="Electrical Technology School">
                            <option value="Certificate in Solar PV Technology & Electrical Wiring">Certificate in Solar PV Setup</option>
                            <option value="Diploma in Domestic & Industrial Electrical Engineering">Diploma in Electrical Engineering</option>
                          </optgroup>
                          <optgroup label="School of Theological Studies">
                            <option value="Certificate in Theology & Biblical Studies">Certificate in Theology & Biblical Studies</option>
                            <option value="Diploma in Theology & Christian Ministry">Diploma in Theology & Christian Ministry</option>
                          </optgroup>
                        </select>
                      </div>

                    </div>

                    {/* Conditional Fields ONLY for Online Admission */}
                    {formType === 'apply' && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="space-y-4 pt-4 border-t border-dashed border-slate-200 dark:border-slate-800"
                      >
                        <div className="grid sm:grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="text-slate-400 dark:text-slate-500 uppercase tracking-widest text-[10px]">Applicant Gender *</label>
                            <select
                              value={formData.gender}
                              onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                              className="w-full p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white outline-none focus:border-blue-500"
                            >
                              <option value="Female">Female</option>
                              <option value="Male">Male</option>
                              <option value="Other">Other</option>
                            </select>
                          </div>

                          <div className="space-y-1">
                            <label className="text-slate-400 dark:text-slate-500 uppercase tracking-widest text-[10px]">Date of Birth *</label>
                            <input
                              type="date"
                              required={formType === 'apply'}
                              value={formData.dateOfBirth}
                              onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                              className="w-full p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white outline-none focus:border-blue-500"
                            />
                          </div>
                        </div>

                        <div className="grid sm:grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="text-slate-400 dark:text-slate-500 uppercase tracking-widest text-[10px]">School Last Attended (e.g. Secondary School)</label>
                            <input
                              type="text"
                              placeholder="e.g. Thika High School"
                              value={formData.prevSchool}
                              onChange={(e) => setFormData({ ...formData, prevSchool: e.target.value })}
                              className="w-full p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white outline-none focus:border-blue-500"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-slate-400 dark:text-slate-500 uppercase tracking-widest text-[10px]">Target Intake Period</label>
                            <select
                              value={formData.intakePeriod}
                              onChange={(e) => setFormData({ ...formData, intakePeriod: e.target.value })}
                              className="w-full p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white outline-none focus:border-blue-500"
                            >
                              <option value="September 2026 Intake">September 2026 Intake (Ongoing)</option>
                              <option value="January 2027 Intake">January 2027 Intake</option>
                              <option value="May 2027 Intake">May 2027 Intake</option>
                            </select>
                          </div>
                        </div>

                        <div className="grid sm:grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="text-slate-400 dark:text-slate-500 uppercase tracking-widest text-[10px]">Parent / Guardian Emergency Guardian Name *</label>
                            <input
                              type="text"
                              required={formType === 'apply'}
                              placeholder="George Kamau"
                              value={formData.guardianName}
                              onChange={(e) => setFormData({ ...formData, guardianName: e.target.value })}
                              className="w-full p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white outline-none focus:border-blue-500"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-slate-400 dark:text-slate-500 uppercase tracking-widest text-[10px]">Guardian Emergency Telephone Number *</label>
                            <input
                              type="tel"
                              required={formType === 'apply'}
                              placeholder="0733 000 000"
                              value={formData.guardianPhone}
                              onChange={(e) => setFormData({ ...formData, guardianPhone: e.target.value })}
                              className="w-full p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white outline-none focus:border-blue-500"
                            />
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {/* Message or Notes input */}
                    <div className="space-y-1">
                      <label className="text-slate-400 dark:text-slate-500 uppercase tracking-widest text-[10px]">Additional Notes / Specific Questions</label>
                      <textarea
                        rows={4}
                        placeholder={formType === 'inquiry' ? "Write your questions here..." : "Any physical issues, scholarship inquiries, or personal training details..."}
                        value={formData.message}
                        onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                        className="w-full p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-205 dark:border-slate-800 text-slate-900 dark:text-white outline-none focus:border-blue-500"
                      />
                    </div>

                    {/* Submit Button */}
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-blue-700 to-blue-600 hover:from-blue-800 hover:to-blue-700 text-white font-black font-alt text-xs uppercase tracking-widest shadow-md active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {isSubmitting ? (
                        <>
                          <span className="w-4 h-4 rounded-full border-t-2 border-r-2 border-white animate-spin"></span>
                          <span>Securing Connection...</span>
                        </>
                      ) : (
                        <>
                          <Send size={15} />
                          <span>{formType === 'inquiry' ? 'Send Quick Inquiry Record' : 'Submit My Certified Online Enrolment'}</span>
                        </>
                      )}
                    </button>

                  </motion.form>
                )}
              </AnimatePresence>

            </div>

          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────
          9. COMPREHENSIVE FOOTER & SOCIAL LINKS
          ───────────────────────────────────────────────────────────────── */}
      <footer className="bg-slate-900 text-slate-350 pt-16 pb-8 border-t border-slate-800 font-alt text-xs transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid md:grid-cols-4 gap-12 border-b border-slate-805 pb-12">
          
          {/* Logo Brand column */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              {settings?.publicLogoUrl || settings?.logoUrl ? (
                <img
                  src={settings?.publicLogoUrl || settings?.logoUrl}
                  alt={settings?.appTitle || "School Logo"}
                  className="h-10 w-auto object-contain max-w-[110px] rounded bg-white p-1"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="h-10 w-10 rounded-xl bg-blue-600 flex items-center justify-center text-white text-base font-heading font-black">
                  {settings?.appTitle || 'BITC'}
                </div>
              )}
              <div>
                <span className="block font-heading font-black uppercase text-xs text-white tracking-widest leading-tight">
                  {settings?.schoolName || 'Breakthrough'}
                </span>
                <span className="block text-[9px] font-semibold text-emerald-450 uppercase tracking-wider font-alt">
                  {settings?.appTitle ? `${settings.appTitle} College` : 'International Training'}
                </span>
              </div>
            </div>
            <p className="text-slate-400 capitalize text-[11px] leading-relaxed">
              Your gateway to secure practical education, certified healthcare caregiving options, and advanced electrical software training.
            </p>
            <p className="text-[10px] text-slate-500">
              © 2026 Breakthrough International Training College. All rights reserved. Registered under Kenyan Ministry of Higher Education.
            </p>
          </div>

          {/* Quick links */}
          <div className="space-y-4">
            <h4 className="font-extrabold uppercase text-white tracking-widest text-[11px]">Training Programs</h4>
            <div className="flex flex-col gap-2.5 text-[11px]">
              <a href="#programs" onClick={() => setSelectedCategory('cosmetology')} className="hover:text-white">Cosmetology & Hairdressing</a>
              <a href="#programs" onClick={() => setSelectedCategory('ict')} className="hover:text-white">ICT & Software Architecture</a>
              <a href="#programs" onClick={() => setSelectedCategory('healthcare')} className="hover:text-white">Caregiver Healthcare Studies</a>
              <a href="#programs" onClick={() => setSelectedCategory('hospitality')} className="hover:text-white">Culinary Pastry Culinary Arts</a>
              <a href="#programs" onClick={() => setSelectedCategory('engineering')} className="hover:text-white">Solar PV & Electrical Systems</a>
              <a href="#programs" onClick={() => setSelectedCategory('theology')} className="hover:text-white">School of Theological Studies</a>
            </div>
          </div>

          {/* College Campus info */}
          <div className="space-y-4">
            <h4 className="font-extrabold uppercase text-white tracking-widest text-[11px]">The Institutions</h4>
            <div className="flex flex-col gap-2.5 text-[11px]">
              <a href="#about" className="hover:text-white">About College Foundations</a>
              <a href="#statistics" className="hover:text-white">Our Certified Milestones</a>
              <a href="#gallery" className="hover:text-white">Campus Activity Galleries</a>
              <a href="#testimonials" className="hover:text-white">Student Placement Testimonial</a>
              <Link to="/auth" className="hover:text-white text-emerald-400 flex items-center gap-1 font-bold">
                Student & Teacher Web Portal
                <ExternalLink size={11} />
              </Link>
            </div>
          </div>

          {/* Contacts info */}
          <div className="space-y-4">
            <h4 className="font-extrabold uppercase text-white tracking-widest text-[11px]">Help & Inquiries</h4>
            <div className="flex flex-col gap-2.5 text-[11px] text-slate-400">
              <p>Primary Office: Thika Kiganjo Corner 2</p>
              <p>Mobile: 0727 114 355 / 0707 760 239</p>
              <p>Secondary: info@breakthrough.ac.ke</p>
              
              {/* Social media icons */}
              <div className="pt-2 flex gap-3 text-white">
                <span className="cursor-pointer hover:text-emerald-400 text-lg">🌐</span>
                <span className="cursor-pointer hover:text-blue-505 text-lg">📘</span>
                <span className="cursor-pointer hover:text-pink-500 text-lg">📸</span>
                <span className="cursor-pointer hover:text-red-500 text-lg">📺</span>
              </div>
            </div>
          </div>

        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-slate-500 text-[10px]">
          <div className="flex flex-col gap-1 text-center sm:text-left">
            <p>Breakthrough International Training College is TVETA Certified under Technical Vocations standard frameworks.</p>
            <p className="text-slate-600 dark:text-slate-400">Designed by Davetech Solutions 2026</p>
          </div>
          <div className="flex gap-4">
            <span className="hover:text-slate-300 cursor-pointer">Privacy Statement</span>
            <span className="hover:text-slate-300 cursor-pointer">Student Rules Handbook</span>
            <span className="hover:text-slate-300 cursor-pointer">Support Channels</span>
          </div>
        </div>
      </footer>

      {/* ─────────────────────────────────────────────────────────────────
          10. FLOATING WHATSAPP CTA WIDGET
          ───────────────────────────────────────────────────────────────── */}
      <a
        href="https://wa.me/254727114355?text=Hello%20Breakthrough%20International%20Training%20College%20-%20I%2520am%2520inquiring%2520about%2520September%2525202026%252520Intakes."
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 z-40 p-4 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white shadow-2xl hover:scale-110 active:scale-95 transition-all duration-300 flex items-center justify-center gap-2 group cursor-pointer"
        aria-label="Direct Chat on WhatsApp"
        id="whatsapp-widget"
      >
        <MessageCircle size={24} className="fill-current" />
        <span className="max-w-0 overflow-hidden group-hover:max-w-[150px] transition-all duration-500 ease-in-out text-xs font-black uppercase tracking-wider font-alt whitespace-nowrap">
          Chat With Admissions
        </span>
      </a>

    </div>
  );
}
