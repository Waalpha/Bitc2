import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../components/AuthProvider';
import { motion } from 'motion/react';
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
  Clock
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

  const heroTitle = settings?.publicHeroTitle || 'Empowering Professionals, Shaping Futures';
  const heroDescription = settings?.publicHeroDescription || 'Breakthrough International Training College offers world-class professional training, focusing on practical skills and career readiness.';
  const heroImage = settings?.publicHeroImageUrl || 'https://images.unsplash.com/photo-1523050853064-85216775870f?q=80&w=2070&auto=format&fit=crop';
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
      id: 'cosmetology',
      title: 'School of Cosmetology & Hairdressing',
      desc: 'Master the art of beauty therapy, salon management, and hairdressing from industry experts.',
      duration: '6 - 12 Months',
      icon: Heart,
      color: 'bg-rose-50 text-rose-600 border-rose-100'
    },
    {
      id: 'ict',
      title: 'School of ICT & Software Engineering',
      desc: 'Build systems, programming foundations, networks, and advanced database operations.',
      duration: '1 - 2 Years',
      icon: BookOpen,
      color: 'bg-indigo-50 text-indigo-600 border-indigo-100'
    },
    {
      id: 'business',
      title: 'School of Business & Accountancy',
      desc: 'Prepare for professional credentials (KASNEB, CPA) and master standard business management.',
      duration: '1 - 2 Years',
      icon: Award,
      color: 'bg-emerald-50 text-emerald-600 border-emerald-100'
    },
    {
      id: 'hospitality',
      title: 'School of Hospitality & Food Operations',
      desc: 'Acquire practical training in baking, culinary arts, pastry making and hotel operations.',
      duration: '6 - 12 Months',
      icon: Sparkles,
      color: 'bg-amber-50 text-amber-600 border-amber-100'
    },
    {
      id: 'engineering',
      title: 'School of Electrical & Tech Engineering',
      desc: 'Learn high-level electronics, wiring installations, power systems, and maintenance mechanics.',
      duration: '1 - 2 Years',
      icon: Building,
      color: 'bg-sky-50 text-sky-600 border-sky-100'
    }
  ];

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
      setTimeout(() => setInquirySuccess(false), 5000);
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
      {/* Premium Navbar */}
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-100 px-6 py-4 transition-all">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-extrabold shadow-md shadow-indigo-150">
              {settings?.logoUrl ? (
                <img src={settings.logoUrl} alt="Logo" className="w-7 h-7 object-contain" />
              ) : (
                <GraduationCap size={22} />
              )}
            </div>
            <div className="text-left leading-tight">
              <span className="text-sm font-extrabold text-slate-900 uppercase tracking-tight block">
                {settings?.schoolName || 'Breakthrough College'}
              </span>
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest block">
                Smart Campus Portal
              </span>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-8 text-xs font-black uppercase tracking-wider text-slate-600">
            <a href="#about" className="hover:text-indigo-600 transition-colors">About Us</a>
            <a href="#departments" className="hover:text-indigo-600 transition-colors">Courses</a>
            <a href="#gallery" className="hover:text-indigo-600 transition-colors">Gallery</a>
            <a href="#contact" className="hover:text-indigo-600 transition-colors">Contact</a>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={navToAuth}
              className="px-5 py-2.5 bg-indigo-600 text-white hover:bg-indigo-700 transition-all rounded-xl text-xs font-black uppercase tracking-wider shadow-md shadow-indigo-150/50 flex items-center gap-2"
            >
              <span>{user ? 'Enter Dashboard' : 'Portal Login'}</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <header className="relative bg-white overflow-hidden border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 py-16 md:py-28 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center relative z-10">
          <div className="lg:col-span-7 space-y-6 text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-50 border border-indigo-100 text-indigo-700 text-[10px] font-extrabold uppercase tracking-widest rounded-full">
              <Sparkles size={12} />
              <span>Admissions Open for Year 2026/2027</span>
            </div>
            
            <h1 className="text-4xl md:text-6xl font-black text-slate-950 tracking-tight leading-[1.1]">
              {heroTitle}
            </h1>
            
            <p className="text-sm md:text-base text-gray-500 leading-relaxed max-w-xl font-medium">
              {heroDescription}
            </p>

            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <button
                onClick={navToAuth}
                className="px-7 py-4 bg-indigo-600 text-white hover:bg-indigo-700 transition-all rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg shadow-indigo-150/50 flex items-center justify-center gap-2"
              >
                <span>Access Student Portal</span>
                <ArrowRight size={14} />
              </button>
              <a
                href="#contact"
                className="px-7 py-4 border border-gray-200 text-slate-700 hover:bg-gray-50 transition-all rounded-2xl text-xs font-black uppercase tracking-widest flex items-center justify-center"
              >
                Enroll / Send Inquiry
              </a>
            </div>

            {/* Minor features line */}
            <div className="grid grid-cols-3 gap-6 pt-10 border-t border-gray-100 max-w-lg">
              <div>
                <span className="block text-2xl font-black text-slate-950 leading-none">100%</span>
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mt-1">Practical Labs</span>
              </div>
              <div>
                <span className="block text-2xl font-black text-slate-950 leading-none">TVETCDAAC</span>
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mt-1">Accredited Exams</span>
              </div>
              <div>
                <span className="block text-2xl font-black text-slate-950 leading-none">200+</span>
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mt-1">Graduates</span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 relative">
            <div className="absolute inset-0 bg-indigo-200 rounded-3xl rotate-3 scale-95 opacity-50 blur-sm" />
            <div className="relative aspect-[4/3] sm:aspect-square bg-slate-100 rounded-3xl overflow-hidden shadow-2xl border-4 border-white">
              <img 
                src={heroImage} 
                alt="Breakthrough Students" 
                className="w-full h-full object-cover transition-transform hover:scale-105 duration-700" 
              />
            </div>
          </div>
        </div>
      </header>

      {/* About Section */}
      <section id="about" className="py-20 bg-slate-50 border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-16 items-center">
          <div className="lg:col-span-5 relative">
            <div className="relative aspect-[4/3] rounded-3xl overflow-hidden shadow-xl border border-gray-100 bg-white p-2">
              <img src={aboutImage} alt="Campus Life" className="w-full h-full object-cover rounded-2xl" />
            </div>
          </div>

          <div className="lg:col-span-7 space-y-6 text-left">
            <span className="text-xs font-black tracking-widest uppercase text-indigo-600 block">About Breakthrough College</span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-slate-950 tracking-tight">{aboutTitle}</h2>
            <div className="text-sm text-gray-500 leading-relaxed font-medium space-y-4">
              <p>{aboutUsText}</p>
              <div className="grid grid-cols-2 gap-4 pt-4 text-xs font-bold text-slate-700">
                <div className="flex items-center gap-2">
                  <CheckCircle size={16} className="text-indigo-600 bg-indigo-50 p-0.5 rounded-full" />
                  <span>Licensed Technical Training</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle size={16} className="text-indigo-600 bg-indigo-50 p-0.5 rounded-full" />
                  <span>Experienced Facilitators</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle size={16} className="text-indigo-600 bg-indigo-50 p-0.5 rounded-full" />
                  <span>Affordable Semester Fees</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle size={16} className="text-indigo-600 bg-indigo-50 p-0.5 rounded-full" />
                  <span>Flexible Payment Installments</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Departments Section */}
      <section id="departments" className="py-20 bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 text-center space-y-12">
          <div className="space-y-4 max-w-2xl mx-auto">
            <span className="text-xs font-black tracking-widest uppercase text-indigo-600 block">Offerings & Programs</span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-slate-950 tracking-tight">Our Professional Departments</h2>
            <p className="text-sm text-gray-400 font-semibold leading-relaxed">
              Explore hands-on skill development courses engineered to transition you directly into active career roles.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {courses.map((course) => {
              const IconComp = course.icon;
              return (
                <div 
                  key={course.id} 
                  className="bg-slate-50 border border-gray-100 rounded-3xl p-6 text-left transition-all hover:scale-[1.02] hover:shadow-xl hover:shadow-slate-100/50 flex flex-col justify-between"
                >
                  <div className="space-y-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border ${course.color}`}>
                      <IconComp size={22} />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-base font-extrabold text-slate-900 tracking-tight">{course.title}</h3>
                      <p className="text-xs text-gray-500 leading-relaxed font-semibold">{course.desc}</p>
                    </div>
                  </div>
                  <div className="flex justify-between items-center pt-6 border-t border-slate-100 mt-6 text-[11px] font-extrabold uppercase tracking-wider text-gray-400">
                    <span className="flex items-center gap-1">
                      <Clock size={12} />
                      {course.duration}
                    </span>
                    <a href="#contact" className="text-indigo-600 hover:underline flex items-center gap-1">
                      Inquire
                      <ArrowRight size={10} />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Gallery Section */}
      <section id="gallery" className="py-20 bg-slate-50 border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 text-center space-y-12">
          <div className="space-y-4 max-w-2xl mx-auto">
            <span className="text-xs font-black tracking-widest uppercase text-indigo-600 block">Captured Moments</span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-slate-950 tracking-tight">Campus Gallery</h2>
            <p className="text-sm text-gray-400 font-semibold leading-relaxed">
              A look at our student life, lab training practices, workshops, and graduation ceremonies.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {galleryImages.map((image, idx) => (
              <div 
                key={`${image}_${idx}`} 
                className="aspect-square bg-slate-200 rounded-2xl overflow-hidden border border-gray-100 shadow-md group relative cursor-pointer"
              >
                <img 
                  src={image} 
                  alt={`Campus item ${idx + 1}`} 
                  className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-500" 
                />
                <div className="absolute inset-0 bg-indigo-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <span className="px-4 py-2 bg-white text-slate-900 font-bold rounded-xl text-[10px] tracking-wider uppercase">View Campus</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact and Admissions Section */}
      <section id="contact" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-16">
          
          {/* Left Column: Info and map embed */}
          <div className="lg:col-span-5 space-y-8 text-left">
            <div className="space-y-4">
              <span className="text-xs font-black tracking-widest uppercase text-indigo-600 block">Get in Touch</span>
              <h2 className="text-3xl font-extrabold text-slate-950 tracking-tight">Find Us in Thika</h2>
              <p className="text-sm text-gray-500 leading-relaxed font-semibold">
                Visit our campus or contact support for full details on class timetables, enrollment deadlines, and scholarship placements.
              </p>
            </div>

            <div className="space-y-4 text-xs font-bold text-slate-700">
              <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-xl border border-gray-100">
                <div className="w-10 h-10 bg-indigo-50 border border-indigo-100 rounded-lg flex items-center justify-center text-indigo-600 shrink-0">
                  <Phone size={18} />
                </div>
                <div>
                  <p className="text-gray-400 text-[10px] uppercase font-black tracking-wider leading-none mb-1">Call Us</p>
                  <p className="text-slate-900 tracking-wider text-sm">{settings?.publicPhone || '+254 700 000 000'}</p>
                </div>
              </div>

              <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-xl border border-gray-100">
                <div className="w-10 h-10 bg-indigo-50 border border-indigo-100 rounded-lg flex items-center justify-center text-indigo-600 shrink-0">
                  <Mail size={18} />
                </div>
                <div>
                  <p className="text-gray-400 text-[10px] uppercase font-black tracking-wider leading-none mb-1">Email Support</p>
                  <p className="text-slate-900 text-sm truncate w-[240px] md:w-auto">{settings?.publicEmail || 'info@breakthrough.ac.ke'}</p>
                </div>
              </div>

              <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-xl border border-gray-100">
                <div className="w-10 h-10 bg-indigo-50 border border-indigo-100 rounded-lg flex items-center justify-center text-indigo-600 shrink-0">
                  <MapPin size={18} />
                </div>
                <div>
                  <p className="text-gray-400 text-[10px] uppercase font-black tracking-wider leading-none mb-1">Campus Location</p>
                  <p className="text-slate-900 text-sm">{settings?.publicAddress || 'Thika Kiganjo Corner 2, Kenya'}</p>
                </div>
              </div>
            </div>

            {/* Google Map Embed */}
            {settings?.publicLocationEmbed && (
              <div className="h-56 rounded-2xl overflow-hidden border border-gray-100 shadow-sm bg-slate-100">
                <iframe 
                  src={settings.publicLocationEmbed} 
                  className="w-full h-full border-0" 
                  allowFullScreen={false} 
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  title="Campus Google Map"
                />
              </div>
            )}
          </div>

          {/* Right Column: Inquiry enrollment form */}
          <div className="lg:col-span-7 bg-slate-50 border border-gray-100 rounded-3xl p-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-100 rounded-full blur-2xl opacity-40 translate-x-12 -translate-y-12" />
            
            <div className="space-y-6 text-left relative z-10">
              <div>
                <h3 className="text-lg font-black text-slate-950 uppercase tracking-tight">Enrollment & Inquiry Form</h3>
                <p className="text-xs text-gray-400 font-bold mt-1">Start your breakthrough educational journey today</p>
              </div>

              {inquirySuccess ? (
                <div className="p-6 bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-2xl flex flex-col items-center justify-center gap-3 text-center">
                  <CheckCircle size={36} className="text-emerald-600" />
                  <h4 className="text-sm font-extrabold">Inquiry Sent Successfully!</h4>
                  <p className="text-xs leading-relaxed max-w-sm">
                    Thank you for contacting us. An admissions representative will review your message and contact you via email or phone within 24 working hours.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleInquirySubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block ml-1">Your Full Name</label>
                      <input 
                        type="text" 
                        required
                        value={inquiryForm.name}
                        onChange={e => setInquiryForm(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="John Doe"
                        className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-4 focus:ring-indigo-50 focus:border-indigo-500 outline-none transition-all placeholder:text-gray-300"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block ml-1">Email Address</label>
                      <input 
                        type="email" 
                        required
                        value={inquiryForm.email}
                        onChange={e => setInquiryForm(prev => ({ ...prev, email: e.target.value }))}
                        placeholder="john@example.com"
                        className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-4 focus:ring-indigo-50 focus:border-indigo-500 outline-none transition-all placeholder:text-gray-300"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block ml-1">Phone Number (Optional)</label>
                      <input 
                        type="text" 
                        value={inquiryForm.phone}
                        onChange={e => setInquiryForm(prev => ({ ...prev, phone: e.target.value }))}
                        placeholder="+254 7XX XXX XXX"
                        className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-4 focus:ring-indigo-50 focus:border-indigo-500 outline-none transition-all placeholder:text-gray-300"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block ml-1">Course of Interest</label>
                      <select 
                        value={inquiryForm.course}
                        onChange={e => setInquiryForm(prev => ({ ...prev, course: e.target.value }))}
                        className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-4 focus:ring-indigo-50 focus:border-indigo-500 outline-none transition-all"
                      >
                        <option value="">Select a Program</option>
                        <option value="Cosmetology">Cosmetology & Hairdressing</option>
                        <option value="ICT">ICT & Software Engineering</option>
                        <option value="Health">Healthcare Support Services</option>
                        <option value="Hospitality">Hospitality & Food Operations</option>
                        <option value="Electrical">Electrical Tech Engineering</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block ml-1">Your Message / Inquiry</label>
                    <textarea 
                      required
                      value={inquiryForm.message}
                      onChange={e => setInquiryForm(prev => ({ ...prev, message: e.target.value }))}
                      placeholder="Ask us anything about semester dates, admissions, fees..."
                      rows={4}
                      className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-4 focus:ring-indigo-50 focus:border-indigo-500 outline-none transition-all placeholder:text-gray-300 resize-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isInquiring}
                    className="w-full py-4 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-md shadow-indigo-150/50 flex items-center justify-center gap-2"
                  >
                    {isInquiring ? (
                      <span className="animate-pulse">Sending Inquiry...</span>
                    ) : (
                      <>
                        <Send size={14} />
                        <span>Send Message</span>
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          </div>

        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-905 text-white py-12 px-6 border-t border-slate-800 mt-auto bg-[#040824]">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="text-left">
            <h4 className="text-sm font-black uppercase tracking-wider">{settings?.schoolName || 'Breakthrough College'}</h4>
            <p className="text-[10px] text-slate-400 mt-1 font-bold">Smart Student & Institutional Management Portal</p>
          </div>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
            &copy; {new Date().getFullYear()} Breakthrough College • All Rights Reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
