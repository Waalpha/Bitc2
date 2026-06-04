import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../components/AuthProvider';
import { motion, AnimatePresence } from 'motion/react';
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
  Sparkles,
  Heart,
  Calendar,
  CheckCircle,
  Clock,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ExternalLink,
  ShieldCheck,
  Check,
  MessageCircle,
  Briefcase,
  Layers,
  HelpCircle,
  TrendingUp,
  Sliders,
  DollarSign,
  Coffee,
  CheckSquare
} from 'lucide-react';
import { addDoc, collection } from 'firebase/firestore';
import { db } from '../firebase';

export function PublicPortal() {
  const { settings, user } = useAuth();
  const navigate = useNavigate();

  // Visitor Inquiry Form States
  const [inquiryForm, setInquiryForm] = useState({
    name: '',
    email: '',
    phone: '',
    course: '',
    message: ''
  });
  const [isInquiring, setIsInquiring] = useState(false);
  const [inquirySuccess, setInquirySuccess] = useState(false);

  // Interface Interactive States
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'cosmetology' | 'ict' | 'Healthcare' | 'hospitality' | 'engineering'>('all');
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  const heroTitle = settings?.publicHeroTitle || 'Empowering Professionals, Shaping Futures';
  const heroDescription = settings?.publicHeroDescription || 'Breakthrough International Training College offers world-class professional training, focusing on practical skills and career readiness.';
  const heroImage = settings?.publicHeroImageUrl || 'https://images.unsplash.com/photo-1523050853064-85216775870f?q=80&w=2070&auto=format&fit=crop';

  const defaultSlides = [
    {
      url: heroImage,
      title: heroTitle,
      description: heroDescription,
      badge: 'Admissions Open for Year 2026/2027',
      tagline: 'World-Class Technical & Healthcare Training'
    },
    {
      url: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?q=80&w=2070&auto=format&fit=crop',
      title: 'Practical Hands-on Skill Offerings',
      description: 'Master practical industry operations across Cosmetology, ICT & Software, Electrical Engineering, Healthcare, and Culinary Arts.',
      badge: '100% Practical Training Labs',
      tagline: 'Equipping Competence and Readiness'
    },
    {
      url: 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?q=80&w=2070&auto=format&fit=crop',
      title: 'Accredited Professional Certifications',
      description: 'Our technical curriculums are fully customized to guarantee national and international examination success (NITA, KNEC, TVETCDACC).',
      badge: 'Fully Accredited & Licensed',
      tagline: 'Guaranteed Academic Success'
    },
    {
      url: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=2070&auto=format&fit=crop',
      title: 'Flexible Semesters & Payment Models',
      description: 'Enjoy highly subsidized and modular technical course fees designed with easy installment arrangements for student learners.',
      badge: 'Affordable World-Class Training',
      tagline: 'Low Costs & Installment Plans'
    }
  ];

  const heroSlides = settings?.publicHeroImages && settings.publicHeroImages.length > 0
    ? settings.publicHeroImages.map((url, idx) => {
        if (idx === 0) {
          return {
            url,
            title: heroTitle,
            description: heroDescription,
            badge: 'Admissions Open for Year 2026/2027',
            tagline: 'Smart Campus Offering'
          };
        }
        const backingInfo = [
          {
            title: 'Empowering Professional Competency',
            description: 'Provide state-of-the-art classroom facilities, fully equipped laboratories, and experienced industry training mentors.',
            badge: 'Pristine Learning Ecosystem',
            tagline: 'Practical Skills Priority'
          },
          {
            title: 'Accredited and Career-Ready Paths',
            description: 'Elevate your employment opportunities by training in officially licensed and globally recognized certificate syllabuses.',
            badge: 'Industrial Accreditation Included',
            tagline: 'Seamless Professional Growth'
          },
          {
            title: 'Learn, Innovate, and Breakthrough',
            description: 'Be part of a thriving campus community focusing on actual product designs, creative development, and real-world tools.',
            badge: 'Nurturing Global Innovators',
            tagline: 'Start Your Journey Today'
          }
        ];
        const backup = backingInfo[(idx - 1) % backingInfo.length];
        return {
          url,
          title: backup.title,
          description: backup.description,
          badge: backup.badge,
          tagline: backup.tagline
        };
      })
    : defaultSlides;

  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlideIndex((prev) => (prev + 1) % heroSlides.length);
    }, 6500);
    return () => clearInterval(timer);
  }, [heroSlides.length]);

  const handleNextSlide = () => {
    setCurrentSlideIndex((prev) => (prev + 1) % heroSlides.length);
  };

  const handlePrevSlide = () => {
    setCurrentSlideIndex((prev) => (prev - 1 + heroSlides.length) % heroSlides.length);
  };

  const currentSlide = heroSlides[currentSlideIndex];
  const aboutUsText = settings?.portalAboutUs || 'Breakthrough International Training College (BITC) is a premier institution of higher learning committed to providing high-quality, practical, and affordable technical and business education. Located in Thika, Kenya, we pride ourselves on nurturing talent, developing competence, and fostering innovation across diverse fields.';
  const aboutTitle = settings?.aboutTitle || 'A Breakthrough in Professional Education';
  const aboutImage = settings?.aboutImageUrl || 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?q=80&w=1200&auto=format&fit=crop';

  const defaultGallery = [
    'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?q=80&w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1531482615713-2afd69097998?q=80&w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1544717305-2782549b5136?q=80&w=800&auto=format&fit=crop'
  ];

  const galleryImages = settings?.portalGallery && settings.portalGallery.length > 0 
    ? settings.portalGallery 
    : defaultGallery;

  const courses = [
    {
      id: 'cosmetology-1',
      title: 'School of Cosmetology & Hairdressing',
      category: 'cosmetology',
      desc: 'Master beauty therapy, professional makeup, nail technology, hairdressing, and salon management from experts.',
      duration: '6 - 12 Months',
      icon: Heart,
      color: 'bg-rose-50 text-rose-600 border-rose-100',
      badge: 'NITA Certified',
      skills: ['Makeup Artistry', 'Nail Tech', 'Advanced Styling', 'Salon Operations'],
      requirements: 'Open enrollment'
    },
    {
      id: 'ict-1',
      title: 'School of ICT & Software Engineering',
      category: 'ict',
      desc: 'Build systems, programming foundations, databases, web development, and networks for modern industrial needs.',
      duration: '1 - 2 Years',
      icon: BookOpen,
      color: 'bg-indigo-50 text-indigo-600 border-indigo-100',
      badge: 'KNEC / NITA Certified',
      skills: ['Python Basics', 'Web Dev', 'Networking', 'Database Design'],
      requirements: 'KCSE D+ & above'
    },
    {
      id: 'healthcare-1',
      title: 'School of Healthcare & Caregiver',
      category: 'business',
      desc: 'Prepare for top certifications (TVETCDACC, NITA) and acquire skills in healthcare support services.',
      duration: '1 - 2 Years',
      icon: Award,
      color: 'bg-emerald-50 text-emerald-600 border-emerald-100',
      badge: 'TVETCDACC Certified',
      requirements: 'KCSE D- & above'
    },
    {
      id: 'hospitality-1',
      title: 'School of Hospitality & Food Operations',
      category: 'hospitality',
      desc: 'Acquire high-level industry expertise in professional baking, culinary arts, pastry design, and hotel catering.',
      duration: '6 - 12 Months',
      icon: Sparkles,
      color: 'bg-amber-50 text-amber-600 border-amber-100',
      badge: 'KNEC Certified',
      skills: ['Cake Decoration', 'Catering Management', 'Culinary Methods', 'Food Safety'],
      requirements: 'Open enrollment'
    },
    {
      id: 'engineering-1',
      title: 'School of Electrical & Tech Engineering',
      category: 'engineering',
      desc: 'Learn power systems wiring, solar panel installation, mechanical maintenance, electronics, and hazard rules.',
      duration: '1 - 2 Years',
      icon: Building,
      color: 'bg-sky-50 text-sky-600 border-sky-100',
      badge: 'NITA / KNEC',
      skills: ['Electrical Wiring', 'Solar Installation', 'Electronics', 'Industrial Safety'],
      requirements: 'Open enrollment'
    }
  ];

  const filteredCourses = selectedCategory === 'all' 
    ? courses 
    : courses.filter(course => course.category === selectedCategory);

  const faqs = [
    {
      question: "What are the entry requirements for courses?",
      answer: "Most certificate and diploma programs require a minimum of KCSE grade C- or D+ respectively. However, our modular hands-on short courses (such as Baking and Cosmetology) are open to all passionate learners regardless of previous educational background."
    },
    {
      question: "Are the training programs national and internationally recognized?",
      answer: "Yes, Breakthrough International Training College is fully registered and licensed by TVETA. Our curriculum preparatories are fully aligned with premium exam boards including KNEC (Kenya National Examinations Council), NITA (National Industrial Training Authority), and KASNEB."
    },
    {
      question: "Is there a hostel facility for distant students?",
      answer: "We offer secure, subsidized student hostel arrangements close to the college with running water, power backup, and regular professional security patrols, ensuring high student safety and convenience."
    },
    {
      question: "Can I pay course fees in flexible modular installments?",
      answer: "Absolutely! We focus on affordable training. Students can distribute payments easily through our standard 3-part semester installment structure, enabling smooth payment without academic interruptions."
    },
    {
      question: "Do you facilitate student attachments and job placements?",
      answer: "Yes, our Industrial Liaison department directly aids students in seeking mandatory technical attachments inside Thika, Nairobi, and adjoining regions, leveraging our strong partnerships with local salons, software firms, hotels, and workshops."
    }
  ];

  const handleQuickEnquire = (courseName: string) => {
    setInquiryForm(prev => ({
      ...prev,
      course: courseName,
      message: `Hello! I would love to inquire about modules, semester starts, and requirements for the ${courseName}. Please share additional prospectus materials.`
    }));
    const contactSection = document.getElementById('contact');
    if (contactSection) {
      contactSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleInquirySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inquiryForm.name || !inquiryForm.email || !inquiryForm.message) return;
    setIsInquiring(true);
    try {
      await addDoc(collection(db, 'visitor_inquiries'), {
        ...inquiryForm,
        submittedAt: new Date().toISOString()
      });
      setInquirySuccess(true);
      setInquiryForm({ name: '', email: '', phone: '', course: '', message: '' });
      setTimeout(() => setInquirySuccess(false), 8000);
    } catch (err) {
      console.error("Error submitting inquiry: ", err);
    } finally {
      setIsInquiring(false);
    }
  };

  const navToAuth = () => {
    if (user) {
      navigate('/dashboard');
    } else {
      navigate('/auth');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans selection:bg-indigo-600 selection:text-white">
      
      {/* Premium Floating Header */}
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-100/80 px-6 py-4.5 shadow-xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer group" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <div className="w-11 h-11 rounded-2xl bg-indigo-600 flex items-center justify-center text-white font-extrabold shadow-md shadow-indigo-150 transition-all group-hover:scale-105 duration-300">
              {settings?.logoUrl ? (
                <img src={settings.logoUrl} alt="Logo" className="w-8 h-8 object-contain" />
              ) : (
                <GraduationCap size={24} />
              )}
            </div>
            <div className="text-left leading-tight">
              <span className="text-sm font-black text-slate-900 uppercase tracking-tight block">
                {settings?.schoolName || 'Breakthrough College'}
              </span>
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest block font-mono">
                Smart Campus Portal
              </span>
            </div>
          </div>

          <div className="hidden lg:flex items-center gap-8 text-xs font-black uppercase tracking-wider text-slate-500">
            <a href="#about" className="hover:text-indigo-600 transition-colors relative after:absolute after:bottom-[-6px] after:left-0 after:w-0 after:h-0.5 after:bg-indigo-600 hover:after:w-full after:transition-all">About Us</a>
            <a href="#departments" className="hover:text-indigo-600 transition-colors relative after:absolute after:bottom-[-6px] after:left-0 after:w-0 after:h-0.5 after:bg-indigo-600 hover:after:w-full after:transition-all">Programs</a>
            <a href="#milestones" className="hover:text-indigo-600 transition-colors relative after:absolute after:bottom-[-6px] after:left-0 after:w-0 after:h-0.5 after:bg-indigo-600 hover:after:w-full after:transition-all">How to Join</a>
            <a href="#gallery" className="hover:text-indigo-600 transition-colors relative after:absolute after:bottom-[-6px] after:left-0 after:w-0 after:h-0.5 after:bg-indigo-600 hover:after:w-full after:transition-all">Campus life</a>
            <a href="#faqs" className="hover:text-indigo-600 transition-colors relative after:absolute after:bottom-[-6px] after:left-0 after:w-0 after:h-0.5 after:bg-indigo-600 hover:after:w-full after:transition-all">Admissions FAQ</a>
            <a href="#contact" className="hover:text-indigo-600 transition-colors relative after:absolute after:bottom-[-6px] after:left-0 after:w-0 after:h-0.5 after:bg-indigo-600 hover:after:w-full after:transition-all">Inquiries</a>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={navToAuth}
              className="px-5.5 py-3 bg-indigo-600 text-white hover:bg-slate-900 transition-all duration-300 rounded-xl text-xs font-black uppercase tracking-wider shadow-md shadow-indigo-150/50 flex items-center gap-2 cursor-pointer active:scale-95"
            >
              <span>{user ? 'Enter Dashboard' : 'Student Portal'}</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section with Interactive Slideshow spanning full dimension */}
      <header className="relative bg-slate-950 overflow-hidden h-[calc(100vh-76px)] min-h-[600px] flex items-center justify-center">
        {/* Full screen Background Slides Layer */}
        <div className="absolute inset-0 z-0 select-none">
          <AnimatePresence mode="wait">
            <motion.img 
              key={currentSlideIndex}
              src={currentSlide.url} 
              alt={currentSlide.title} 
              initial={{ opacity: 0, scale: 1.05 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.8, ease: "easeInOut" }}
              className="w-full h-full object-cover" 
              referrerPolicy="no-referrer"
            />
          </AnimatePresence>
          {/* Dual layers of dark gradient overlays to guarantee perfect text contrast and design elegance */}
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950/85 via-slate-950/65 to-slate-950/40" />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-slate-950/30" />
        </div>
        
        {/* Centered overlays of text and interactive controls */}
        <div className="max-w-7xl mx-auto px-6 py-12 relative z-10 w-full text-white">
          <div className="max-w-3xl space-y-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentSlideIndex}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.5, ease: "easeInOut" }}
                className="space-y-6"
              >
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-indigo-500/20 border border-indigo-400/30 text-indigo-200 text-[10px] font-black uppercase tracking-widest rounded-full backdrop-blur-md">
                  <Sparkles size={11} className="text-indigo-400 animate-pulse" />
                  <span>{currentSlide.badge}</span>
                </div>
                
                <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-sans font-black text-white tracking-tight leading-[1.12]">
                  {currentSlide.title}
                </h1>
                
                <p className="text-sm md:text-base text-gray-300 leading-relaxed max-w-xl font-medium">
                  {currentSlide.description}
                </p>
              </motion.div>
            </AnimatePresence>
            
            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <button
                onClick={navToAuth}
                className="px-8 py-4.5 bg-indigo-600 hover:bg-indigo-500 text-white transition-all duration-300 rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg shadow-indigo-650/30 flex items-center justify-center gap-2.5 cursor-pointer whitespace-nowrap"
              >
                <span>Access Student Portal</span>
                <ArrowRight size={14} />
              </button>
              <a
                href="#contact"
                className="px-8 py-4.5 bg-slate-900/60 hover:bg-slate-800 border-2 border-white/20 text-white hover:border-white transition-all rounded-2xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 backdrop-blur-md"
              >
                <MessageCircle size={15} />
                <span>Quick Inquiry</span>
              </a>
            </div>

            {/* Quick specifications counter overlay */}
            <div className="grid grid-cols-3 gap-6 pt-10 border-t border-white/15 max-w-lg mt-8">
              <div className="text-left">
                <span className="block text-2.5xl font-black text-white leading-none">100%</span>
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mt-1.5">Hands-On Labs</span>
              </div>
              <div className="text-left">
                <span className="block text-2.5xl font-black text-white leading-none">TVETA</span>
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mt-1.5">Licensed Bureau</span>
              </div>
              <div className="text-left">
                <span className="block text-2.5xl font-black text-white leading-none">200+</span>
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mt-1.5">Graduates Alumni</span>
              </div>
            </div>
          </div>
        </div>

        {/* Side Chevrons Overlays */}
        <div className="absolute inset-y-0 left-4 z-20 flex items-center">
          <button
            onClick={handlePrevSlide}
            className="w-11 h-11 rounded-full bg-black/45 backdrop-blur-md hover:bg-slate-900 text-white flex items-center justify-center border border-white/10 hover:border-white/30 transition-all cursor-pointer shadow-lg hover:scale-105"
            aria-label="Previous slide"
          >
            <ChevronLeft size={18} />
          </button>
        </div>
        <div className="absolute inset-y-0 right-4 z-20 flex items-center">
          <button
            onClick={handleNextSlide}
            className="w-11 h-11 rounded-full bg-black/45 backdrop-blur-md hover:bg-slate-900 text-white flex items-center justify-center border border-white/10 hover:border-white/30 transition-all cursor-pointer shadow-lg hover:scale-105"
            aria-label="Next slide"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        {/* Bottom Navigation Indicators and Tagline */}
        <div className="absolute bottom-8 right-6 z-20 flex items-center gap-4 bg-slate-950/60 backdrop-blur-md px-4 py-2.5 rounded-full border border-white/10">
          <div className="flex gap-1.5">
            {heroSlides.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentSlideIndex(idx)}
                className={`h-2 rounded-full transition-all cursor-pointer ${idx === currentSlideIndex ? 'w-6 bg-indigo-500' : 'w-2 bg-white/40 hover:bg-white/65'}`}
                aria-label={`Go to slide ${idx + 1}`}
              />
            ))}
          </div>
          <div className="text-[10px] font-black text-indigo-200 uppercase tracking-wider border-l border-white/10 pl-4 select-none">
            {currentSlide.tagline}
          </div>
        </div>
      </header>

      {/* About Section & Elegant Core Highlights */}
      <section id="about" className="py-24 bg-slate-50 border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-16 items-center">
          
          <div className="lg:col-span-12 text-center max-w-3xl mx-auto space-y-4 mb-8">
            <span className="text-xs font-black tracking-widest uppercase text-indigo-600 block">BITC Advantage</span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-slate-950 tracking-tight">Earning the Breakthrough Competency</h2>
            <p className="text-sm text-slate-500 font-semibold leading-relaxed">
              We deliver a premium educational ecosystem optimized for high technical output, real professional confidence, and swift industrial deployment.
            </p>
          </div>

          <div className="lg:col-span-5 relative">
            <div className="relative aspect-[4/3] rounded-3xl overflow-hidden shadow-2xl border border-gray-200/60 bg-white p-2">
              <img src={aboutImage} alt="Campus Life" className="w-full h-full object-cover rounded-2xl" referrerPolicy="no-referrer" />
            </div>
          </div>

          <div className="lg:col-span-7 space-y-7 text-left">
            <span className="text-xs font-black tracking-widest uppercase text-indigo-600 block leading-none">Executive Overview</span>
            <h3 className="text-2.5xl font-black text-slate-950 tracking-tight">{aboutTitle}</h3>
            <div className="text-sm text-slate-500 leading-relaxed font-medium space-y-4">
              <p>{aboutUsText}</p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
                <div className="flex items-start gap-3 bg-white p-4.5 rounded-2xl border border-slate-100 shadow-xs">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                    <ShieldCheck size={18} />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-slate-900 uppercase">Licensed and Accredited</h4>
                    <p className="text-[11px] text-gray-400 mt-0.5">Officially registered under TVETA bureaus to grant recognized diploma credits.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 bg-white p-4.5 rounded-2xl border border-slate-100 shadow-xs">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                    <TrendingUp size={18} />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-slate-900 uppercase">Career-Ready Internships</h4>
                    <p className="text-[11px] text-gray-400 mt-0.5">Direct institutional liaisons facilitate fast attachment placements in Thika & Nairobi.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 bg-white p-4.5 rounded-2xl border border-slate-100 shadow-xs">
                  <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 shrink-0">
                    <DollarSign size={18} />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-slate-900 uppercase">Flexible Subsidized Fees</h4>
                    <p className="text-[11px] text-gray-400 mt-0.5">Spaced installment plans crafted to ease payment pressures on parents & students.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 bg-white p-4.5 rounded-2xl border border-slate-100 shadow-xs">
                  <div className="w-8 h-8 rounded-lg bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 shrink-0">
                    <Coffee size={18} />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-slate-900 uppercase">Active Campus Living</h4>
                    <p className="text-[11px] text-gray-400 mt-0.5">High safety accommodations with standard running supplies and study spaces.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Academic Programs & Search Directory Section */}
      <section id="departments" className="py-24 bg-white border-b border-gray-100 relative">
        <div className="max-w-7xl mx-auto px-6 text-center space-y-12">
          
          <div className="space-y-4 max-w-2xl mx-auto">
            <span className="text-xs font-black tracking-widest uppercase text-indigo-600 block">Offerings & Streams</span>
            <h2 className="text-3.5xl font-black text-slate-950 tracking-tight">Our Academic Schools & Certifications</h2>
            <p className="text-sm text-slate-500 font-semibold leading-relaxed">
              Select or filter through our various certified vocational sectors. Click any stream to start your professional enrollment path.
            </p>
          </div>

          {/* Interactive Navigation Filter Tabs */}
          <div className="flex flex-wrap items-center justify-center gap-2 bg-slate-50 p-2 rounded-2.5xl max-w-4xl mx-auto border border-slate-150/40">
            {[
              { id: 'all', label: 'All Schools' },
              { id: 'cosmetology', label: 'Cosmetology' },
              { id: 'ict', label: 'ICT & Software' },
              { id: 'healthcare', label: 'Healthcare & Caregiver' },
              { id: 'hospitality', label: 'Hospitality & Baking' },
              { id: 'engineering', label: 'Electrical Tech' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setSelectedCategory(tab.id as any)}
                className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                  selectedCategory === tab.id 
                    ? 'bg-indigo-600 text-white shadow-md' 
                    : 'text-slate-500 hover:text-indigo-600 hover:bg-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Grid Layout of Filtered streams */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <AnimatePresence mode="popLayout">
              {filteredCourses.map((course) => {
                const IconComp = course.icon;
                return (
                  <motion.div 
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.35 }}
                    key={course.id} 
                    className="bg-slate-50/70 border border-slate-150/50 rounded-3xl p-6.5 text-left transition-all hover:scale-[1.02] hover:bg-white hover:shadow-xl hover:shadow-slate-100/80 flex flex-col justify-between"
                  >
                    <div className="space-y-4">
                      
                      {/* Top Header Row representing cert types */}
                      <div className="flex justify-between items-center">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border shadow-xs ${course.color}`}>
                          <IconComp size={22} />
                        </div>
                        <span className="px-3 py-1 bg-white border border-slate-200/70 text-slate-700 text-[10px] font-extrabold uppercase tracking-widest rounded-full shadow-2xs">
                          {course.badge}
                        </span>
                      </div>

                      <div className="space-y-2">
                        <h3 className="text-base font-black text-slate-900 tracking-tight leading-snug">{course.title}</h3>
                        <p className="text-xs text-slate-500 leading-relaxed font-semibold">{course.desc}</p>
                      </div>

                      {/* Technical Skills Focus Pill Group */}
                      <div className="pt-2">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-2 font-mono">Core Training Modules:</span>
                        <div className="flex flex-wrap gap-1.5">
                          {course.skills.map((skill, sIdx) => (
                            <span 
                              key={`${course.id}_skill_${sIdx}`}
                              className="px-2.5 py-1 bg-indigo-50/40 text-indigo-700 text-[10px] font-extrabold uppercase tracking-wide rounded-md border border-indigo-100/40"
                            >
                              {skill}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Requirements indicator line */}
                      <div className="bg-slate-100/55 p-3 rounded-xl border border-slate-150/40 text-[11px] text-slate-600 font-bold flex gap-1.5 items-center">
                        <CheckSquare size={13} className="text-slate-400" />
                        <span>Reqs: {course.requirements}</span>
                      </div>
                    </div>

                    <div className="flex justify-between items-center pt-5 border-t border-slate-100 mt-6 text-[11px] font-extrabold uppercase tracking-wider text-gray-400">
                      <span className="flex items-center gap-1.5 font-mono text-slate-400">
                        <Clock size={13} className="text-slate-400" />
                        {course.duration}
                      </span>
                      <button 
                        onClick={() => handleQuickEnquire(course.title)}
                        className="text-indigo-600 hover:text-slate-950 flex items-center gap-1 cursor-pointer font-black border-b border-indigo-200 hover:border-slate-950 pb-0.5"
                      >
                        <span>Apply / Enquire</span>
                        <ArrowRight size={12} />
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

        </div>
      </section>

      {/* Modern Student Journey Roadmap Section */}
      <section id="milestones" className="py-24 bg-slate-50 border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 text-center space-y-16">
          <div className="space-y-4 max-w-2xl mx-auto">
            <span className="text-xs font-black tracking-widest uppercase text-indigo-600 block">Enrollment Path</span>
            <h2 className="text-3.5xl font-black text-slate-950 tracking-tight">Your Roadmap to Professional Mastery</h2>
            <p className="text-sm text-slate-500 font-semibold leading-relaxed">
              We make the administrative process clear, modular, and effortless so your primary focus remains centered on practical skill acquisition.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 relative">
            
            {/* Connection Line layer */}
            <div className="hidden md:block absolute top-12 left-1/12 right-1/12 h-0.5 bg-slate-200/80 z-0" />

            {[
              {
                step: "01",
                title: "Submit Inquiry",
                desc: "Send a quick online request highlighting your preferred program or visit our spacious camp premises in Thika."
              },
              {
                step: "02",
                title: "Register & Plan",
                desc: "Complete the offline enrollment form, choose schedules (morning or afternoon shift), and set up your modular payment timeline."
              },
              {
                step: "03",
                title: "Hands-on Training",
                desc: "Attend structured practical sessions in specialized beauty salons, cooking kitchens, or engineering machinery labs."
              },
              {
                step: "04",
                title: "KNEC / NITA Success",
                desc: "Undergo professional testing matrices & graduate. Launch directly into active industry employment with professional trust."
              }
            ].map((milestone, idx) => (
              <div key={idx} className="bg-white p-7 rounded-3xl border border-slate-150/40 relative z-10 text-left shadow-xs flex flex-col justify-between">
                <div>
                  <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white font-extrabold flex items-center justify-center text-sm shadow-md shadow-indigo-150 mb-6">
                    {milestone.step}
                  </div>
                  <h3 className="text-base font-black text-slate-950 mb-2">{milestone.title}</h3>
                  <p className="text-xs text-slate-500 font-semibold leading-relaxed">{milestone.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Campus Gallery Section */}
      <section id="gallery" className="py-24 bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 text-center space-y-12">
          
          <div className="space-y-4 max-w-2xl mx-auto">
            <span className="text-xs font-black tracking-widest uppercase text-indigo-600 block">Captured Moments</span>
            <h2 className="text-3.5xl font-black text-slate-950 tracking-tight">Active Student Operations</h2>
            <p className="text-sm text-slate-500 font-semibold leading-relaxed">
              Explore actual moments captured from practical hair testing, software workshops, commercial baking labs, and certificate gradations.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {galleryImages.map((image, idx) => (
              <div 
                key={`${image}_${idx}`} 
                className="aspect-square bg-slate-200 rounded-3xl overflow-hidden border border-gray-200/80 shadow-md group relative cursor-pointer"
              >
                <img 
                  src={image} 
                  alt={`Campus activity item ${idx + 1}`} 
                  className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-655" 
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-indigo-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center duration-300">
                  <div className="text-center p-3">
                    <Sparkles className="mx-auto text-indigo-300 mb-1 animate-bounce" size={20} />
                    <span className="px-3 py-1.5 bg-white text-indigo-900 font-bold rounded-lg text-[10px] tracking-wider uppercase shadow-md">Breakthrough Campus</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Dynamic Accordion Admissions FAQs Section */}
      <section id="faqs" className="py-24 bg-slate-50 border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-6 space-y-12">
          <div className="text-center space-y-4">
            <span className="text-xs font-black tracking-widest uppercase text-indigo-600 block">Got Questions?</span>
            <h2 className="text-3.5xl font-black text-slate-950 tracking-tight">Frequently Asked Admissions Concerns</h2>
            <p className="text-sm text-slate-500 font-semibold leading-relaxed">
              Find quick solutions and details to support your transition preparations for learning.
            </p>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, idx) => {
              const isOpen = openFaqIndex === idx;
              return (
                <div 
                  key={idx} 
                  className="bg-white border border-slate-150 rounded-2xl overflow-hidden shadow-xs transition-colors duration-200"
                >
                  <button
                    onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                    className="w-full px-6 py-5.5 text-left flex items-center justify-between gap-4 font-black text-slate-900 hover:text-indigo-600 cursor-pointer"
                  >
                    <span className="text-sm md:text-base">{faq.question}</span>
                    <div className={`p-1 rounded-full bg-slate-50 border border-slate-200 transition-transform ${isOpen ? 'rotate-180 bg-indigo-50 text-indigo-600' : ''}`}>
                      <ChevronDown size={16} />
                    </div>
                  </button>

                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="overflow-hidden"
                      >
                        <div className="px-6 pb-6 text-xs md:text-sm text-slate-500 font-medium leading-relaxed border-t border-slate-50 pt-4 bg-slate-50/30">
                          {faq.answer}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Active Inquiry Portal, Live Location Directions, & Contact Area */}
      <section id="contact" className="py-24 bg-white relative">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-16 relative z-10">
          
          {/* Left Column: Direct Address details, maps support */}
          <div className="lg:col-span-5 space-y-8 text-left">
            <div className="space-y-4">
              <span className="text-xs font-black tracking-widest uppercase text-indigo-600 block">Get Guided</span>
              <h2 className="text-3.5xl font-black text-slate-950 tracking-tight">Visit Our Thika Campuses</h2>
              <p className="text-sm text-slate-500 leading-relaxed font-semibold">
                Our main offices are open Monday through Friday from 8:00 AM to 5:00 PM and Saturday from 8:30 AM to 1:00 PM for on-premise enrollment counseling.
              </p>
            </div>

            <div className="space-y-4 text-xs font-bold text-slate-705">
              
              <div className="flex items-center gap-4 bg-slate-50 p-4.5 rounded-2xl border border-slate-100">
                <div className="w-11 h-11 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center justify-center text-indigo-600 shrink-0 shadow-xs">
                  <Phone size={18} />
                </div>
                <div>
                  <p className="text-[9px] text-gray-400 uppercase font-black tracking-wider leading-none mb-1">Phone Line Support</p>
                  <p className="text-slate-900 tracking-wider text-sm font-black">{settings?.publicPhone || '+254 712 345 678'}</p>
                </div>
              </div>

              <div className="flex items-center gap-4 bg-slate-50 p-4.5 rounded-2xl border border-slate-100">
                <div className="w-11 h-11 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center justify-center text-indigo-600 shrink-0 shadow-xs">
                  <Mail size={18} />
                </div>
                <div>
                  <p className="text-[9px] text-gray-400 uppercase font-black tracking-wider leading-none mb-1">Support Email</p>
                  <p className="text-slate-900 text-sm font-black truncate max-w-[240px] md:max-w-none">{settings?.publicEmail || 'info@breakthroughcollege.ac.ke'}</p>
                </div>
              </div>

              <div className="flex items-center gap-4 bg-slate-50 p-4.5 rounded-2xl border border-slate-100">
                <div className="w-11 h-11 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center justify-center text-indigo-600 shrink-0 shadow-xs">
                  <MapPin size={18} />
                </div>
                <div>
                  <p className="text-[9px] text-gray-400 uppercase font-black tracking-wider leading-none mb-1">Physical College Location</p>
                  <p className="text-slate-900 text-sm font-black">{settings?.publicAddress || 'Thika, Kiganjo Corner 2, Kiambu County, Kenya'}</p>
                </div>
              </div>
            </div>

            {/* Subsidized live Google Maps support */}
            {settings?.publicLocationEmbed ? (
              <div className="h-56 rounded-3xl overflow-hidden border border-slate-200/60 shadow-md bg-slate-100">
                <iframe 
                  src={settings.publicLocationEmbed} 
                  className="w-full h-full border-0" 
                  allowFullScreen={false} 
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  title="Campus Google map reference positioning"
                />
              </div>
            ) : (
              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-150 flex flex-col justify-center items-center text-center gap-3">
                <MapPin size={34} className="text-indigo-605 opacity-60" />
                <div>
                  <h4 className="text-xs font-black text-slate-900 mb-1">Thika Main Campus</h4>
                  <p className="text-[11px] text-slate-500 font-medium">Located along general Kiganjo Highway, close to commercial passenger stops.</p>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Premium inquiry and prefilled dynamic admissions box */}
          <div className="lg:col-span-7 bg-slate-50/70 border border-slate-150/60 rounded-3.5xl p-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-150 rounded-full blur-3xl opacity-30 translate-x-12 -translate-y-12" />
            
            <div className="space-y-6 text-left relative z-10">
              <div>
                <h3 className="text-xl font-black text-slate-950 uppercase tracking-tight">Admissions Intake Counseling</h3>
                <p className="text-xs text-slate-500 mt-1 font-bold">Provide secure, clean details. A student guide counselor will follow up.</p>
              </div>

              {inquirySuccess ? (
                <div className="p-8 bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-3xl flex flex-col items-center justify-center gap-4 text-center">
                  <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center">
                    <CheckCircle size={38} className="text-emerald-600" />
                  </div>
                  <h4 className="text-sm font-black uppercase text-slate-900">Inquiry Logged Successfully!</h4>
                  <p className="text-xs leading-relaxed max-w-sm text-slate-500 font-semibold">
                    Thank you for your active interest. Our dedicated registrar has recorded your parameters. An email confirmation has been logged, and we will contact you on WhatsApp or via cell line shortly.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleInquirySubmit} className="space-y-4 font-sans">
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block ml-1">Your Full Name</label>
                      <input 
                        type="text" 
                        required
                        value={inquiryForm.name}
                        onChange={e => setInquiryForm(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="John Doe"
                        className="w-full px-4 py-3 bg-white border border-slate-205 rounded-xl text-xs font-bold text-slate-800 focus:ring-4 focus:ring-indigo-50 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-300 shadow-3xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block ml-1">Active Email Address</label>
                      <input 
                        type="email" 
                        required
                        value={inquiryForm.email}
                        onChange={e => setInquiryForm(prev => ({ ...prev, email: e.target.value }))}
                        placeholder="john@gmail.com"
                        className="w-full px-4 py-3 bg-white border border-slate-205 rounded-xl text-xs font-bold text-slate-800 focus:ring-4 focus:ring-indigo-50 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-300 shadow-3xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block ml-1">Phone / WhatsApp Line</label>
                      <input 
                        type="text" 
                        value={inquiryForm.phone}
                        onChange={e => setInquiryForm(prev => ({ ...prev, phone: e.target.value }))}
                        placeholder="e.g. +254 712 345 678"
                        className="w-full px-4 py-3 bg-white border border-slate-205 rounded-xl text-xs font-bold text-slate-800 focus:ring-4 focus:ring-indigo-50 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-300 shadow-3xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block ml-1">Course of Interest</label>
                      <select 
                        value={inquiryForm.course}
                        onChange={e => setInquiryForm(prev => ({ ...prev, course: e.target.value }))}
                        className="w-full px-4 py-3 bg-white border border-slate-205 rounded-xl text-xs font-bold text-slate-850 focus:ring-4 focus:ring-indigo-50 focus:border-indigo-500 outline-none transition-all shadow-3xs"
                      >
                        <option value="">Select an Academic Path</option>
                        <option value="School of Cosmetology & Hairdressing">Cosmetology & Hairdressing</option>
                        <option value="School of ICT & Software Engineering">ICT & Software Engineering</option>
                        <option value="School of Business & Accountancy">Business Studies & KASNEB Prep</option>
                        <option value="School of Hospitality & Food Operations">Hospitality & Food Baking</option>
                        <option value="School of Electrical & Tech Engineering">Electrical Tech Engineering</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block ml-1">Your Message / Specific Request</label>
                    <textarea 
                      required
                      value={inquiryForm.message}
                      onChange={e => setInquiryForm(prev => ({ ...prev, message: e.target.value }))}
                      placeholder="Ask us anything about semester dates, hostel charges, entry requirements, exam timetables..."
                      rows={4}
                      className="w-full px-4 py-3 bg-white border border-slate-205 rounded-xl text-xs font-bold text-slate-800 focus:ring-4 focus:ring-indigo-50 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-300 resize-none shadow-3xs"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isInquiring}
                    className="w-full py-4 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-900 transition-all duration-300 shadow-md shadow-indigo-150/50 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {isInquiring ? (
                      <span className="animate-pulse">Registering Inquiry...</span>
                    ) : (
                      <>
                        <Send size={14} />
                        <span>Submit Counseling Request</span>
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          </div>

        </div>
      </section>

      {/* Modern Detailed Footer */}
      <footer className="bg-slate-950 text-white py-16 px-6 border-t border-slate-900 mt-auto bg-[#040824]">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-12 text-left mb-12">
          
          <div className="md:col-span-4 space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-extrabold shadow-sm">
                <GraduationCap size={18} />
              </div>
              <h4 className="text-sm font-black uppercase tracking-wider">{settings?.schoolName || 'Breakthrough College'}</h4>
            </div>
            <p className="text-[11px] text-slate-450 leading-relaxed font-semibold max-w-sm">
              Nurturing professional technical competencies, certified industrial excellence, and dynamic career trajectories inside Kiambu County.
            </p>
          </div>

          <div className="md:col-span-3 space-y-3 text-xs">
            <h5 className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Main Streams</h5>
            <ul className="space-y-2 font-bold text-slate-400">
              <li>School of Cosmetology</li>
              <li>School of Software Engineering</li>
              <li>School of Business & Accountancy</li>
              <li>School of Electric Tech</li>
            </ul>
          </div>

          <div className="md:col-span-2 space-y-3 text-xs">
            <h5 className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Exam Boards</h5>
            <ul className="space-y-2 font-bold text-slate-400">
              <li>KNEC examinations</li>
              <li>NITA technical metrics</li>
              <li>KASNEB accounting</li>
              <li>TVETA certifications</li>
            </ul>
          </div>

          <div className="md:col-span-3 space-y-3 text-xs">
            <h5 className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Institutional support</h5>
            <ul className="space-y-2 font-bold text-slate-450 text-slate-400">
              <li>Direct Attachment liaison</li>
              <li>Subsidized secure rooms</li>
              <li>Flexible installments plan</li>
            </ul>
          </div>

        </div>

        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 pt-8 border-t border-slate-900 text-[10px]">
          <div className="text-left">
            <p className="text-slate-400 font-bold uppercase tracking-widest">
              &copy; {new Date().getFullYear()} {settings?.schoolName || 'Breakthrough College'} • All Rights Reserved.
            </p>
          </div>
          <p className="text-slate-500 font-semibold uppercase tracking-widest text-center md:text-right">
            Licensed by TVETA under Ministry of Education, Kenya
          </p>
        </div>
      </footer>
    </div>
  );
}
