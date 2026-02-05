import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Calendar, Heart, Plus, User, MapPin, 
  Smile, Frown, Meh, Lock, ChevronLeft, 
  ChevronRight, Edit2, Trash2, MessageCircle,
  Star, Coffee, Tv, Utensils, Zap, List, Home,
  Camera, ArrowRight, XCircle, CheckCircle, Clock,
  TrendingUp, Activity
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  onAuthStateChanged, 
  signInAnonymously,
  createUserWithEmailAndPassword,  // ADD
  signInWithEmailAndPassword,      // ADD
  signOut,                         // ADD
  updateProfile                    // ADD
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  query, 
  orderBy, 
  onSnapshot, 
  doc, 
  deleteDoc, 
  updateDoc,
  serverTimestamp,
  setDoc,      // ADD
  getDoc       // ADD
} from 'firebase/firestore';

// --- Firebase Setup ---
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'dating-today';

// --- Constants & Helpers ---
const FEELINGS = {
  AWFUL: { label: 'Awful', color: 'bg-rose-500', text: 'text-rose-600', icon: Zap },
  BAD: { label: 'Bad', color: 'bg-rose-300', text: 'text-rose-500', icon: Frown },
  OKAY: { label: 'Okay', color: 'bg-yellow-400', text: 'text-yellow-600', icon: Meh },
  GOOD: { label: 'Good', color: 'bg-purple-400', text: 'text-purple-500', icon: Smile },
  EXCELLENT: { label: 'Excellent', color: 'bg-purple-500', text: 'text-purple-600', icon: Star },
};

const SCHEDULED_THEME = { label: 'Scheduled', color: 'bg-blue-400', text: 'text-blue-500', icon: Clock };

const SCENARIOS = [
  { id: 'coffee', label: 'Coffee Shop', icon: Coffee },
  { id: 'dinner', label: 'Dinner', icon: Utensils },
  { id: 'netflix', label: 'Netflix & Chill', icon: Tv },
  { id: 'activity', label: 'Activity', icon: Zap },
];

const TAGS = [
  "Good conversation", "Good Fashion Taste", "Great chemistry", "Paid the bill", 
  "Thoughtful", "Good looking", "Genuine", "Funny", "Awkward", "Red flag", "Bad manners", 
  "Boring"
];

const DATE_NUMBERS = ["First date", "Second date", "Third date", "4th+", "Relationship"];

const NEXT_STEPS = [
  { id: 'Continue', label: 'Continue', icon: CheckCircle, color: 'text-green-600 bg-green-50 border-green-200' },
  { id: 'End', label: 'End', icon: XCircle, color: 'text-rose-600 bg-rose-50 border-rose-200' },
  { id: 'Unsure', label: 'I don\'t know yet', icon: Meh, color: 'text-gray-600 bg-gray-50 border-gray-200' },
];

// Helper to check if a date string is in the future
const isFutureDate = (dateStr, timeStr) => {
  if (!dateStr) return false;
  const now = new Date();
  const [year, month, day] = dateStr.split('-').map(Number);
  
  let hour = 23;
  let minute = 59;
  
  if (timeStr) {
    const parts = timeStr.split(':').map(Number);
    if (parts.length === 2) {
      hour = parts[0];
      minute = parts[1];
    }
  }
  
  // Note: Month is 0-indexed in JS Date
  const targetDate = new Date(year, month - 1, day, hour, minute);
  return targetDate > now;
};

// Helper to resize image to base64 (max 300px width)
const resizeImage = (file) => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 300;
        const scaleSize = MAX_WIDTH / img.width;
        canvas.width = MAX_WIDTH;
        canvas.height = img.height * scaleSize;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  });
};

// --- Components ---

// 1. Welcome Screen
const WelcomeScreen = ({ onAnswer }) => (
  <div className="flex flex-col items-center justify-center h-full p-6 bg-gradient-to-b from-rose-50 to-white text-center">
    <div className="w-20 h-20 bg-rose-100 rounded-full flex items-center justify-center mb-6 shadow-sm">
      <Heart className="w-10 h-10 text-rose-500 fill-current" />
    </div>
    <h1 className="text-3xl font-bold text-gray-800 mb-2">DatingToday</h1>
    <p className="text-gray-500 mb-12">Track, reflect, and learn from your dating life.</p>
    
    <div className="w-full max-w-sm space-y-4">
      <p className="text-lg font-medium text-gray-700 mb-4">Went on a date today?</p>
      <button 
        onClick={() => onAnswer(true)}
        className="w-full py-4 bg-rose-500 text-white rounded-xl font-bold text-lg shadow-lg hover:bg-rose-600 transition-transform active:scale-95"
      >
        Yes, I have!
      </button>
      <button 
        onClick={() => onAnswer(false)}
        className="w-full py-4 bg-white text-gray-600 border border-gray-200 rounded-xl font-semibold hover:bg-gray-50 transition-colors"
      >
        No, take me to calendar
      </button>
    </div>
  </div>
);


// 2. Scheduled Date Reminder Screen
const ScheduledDateReminderScreen = ({ scheduledDate, onLogDate, onSkip }) => (
  <div className="flex flex-col items-center justify-center h-full p-6 bg-gradient-to-b from-blue-50 to-white text-center">
    <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mb-6 shadow-sm">
      <Clock className="w-10 h-10 text-blue-500" />
    </div>
    <h1 className="text-3xl font-bold text-gray-800 mb-2">How was your date?</h1>
    <p className="text-gray-500 mb-4">You had a scheduled date with</p>
    
    <div className="bg-white rounded-xl p-4 shadow-sm mb-8 w-full max-w-sm">
      <div className="flex items-center gap-3">
        <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center text-2xl font-bold text-gray-600 overflow-hidden">
          {scheduledDate.photo ? (
            <img src={scheduledDate.photo} alt={scheduledDate.name} className="w-full h-full object-cover" />
          ) : (
            <span>{scheduledDate.name ? scheduledDate.name[0].toUpperCase() : '?'}</span>
          )}
        </div>
        <div className="flex-1 text-left">
          <h3 className="text-xl font-bold text-gray-800">{scheduledDate.name}</h3>
          {scheduledDate.title && <p className="text-sm text-gray-500">{scheduledDate.title}</p>}
          <p className="text-sm text-blue-600 mt-1">
            {new Date(scheduledDate.date).toLocaleDateString()} at {scheduledDate.time}
          </p>
        </div>
      </div>
    </div>
    
    <div className="w-full max-w-sm space-y-4">
      <button 
        onClick={onLogDate}
        className="w-full py-4 bg-blue-500 text-white rounded-xl font-bold text-lg shadow-lg hover:bg-blue-600 transition-transform active:scale-95"
      >
        Yes! Log that date
      </button>
      <button 
        onClick={onSkip}
        className="w-full py-4 bg-white text-gray-600 border border-gray-200 rounded-xl font-semibold hover:bg-gray-50 transition-colors"
      >
        No, take me to calendar
      </button>
    </div>
  </div>
);




// 3. Journey Tab (Calendar + Active Dates)
const JourneyTab = ({ dates, onSelectDate, onAddDate, onOpenAI }) => {
  const [currentDate, setCurrentDate] = useState(new Date());

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const days = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();
    return { days, firstDay };
  };

  const { days, firstDay } = getDaysInMonth(currentDate);
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  const changeMonth = (delta) => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + delta, 1));
  };

  const getDatesForDay = (day) => {
    return dates.filter(d => {
      // Parse the date string directly to avoid timezone issues
      const [year, month, dayOfMonth] = d.date.split('-').map(Number);
      return dayOfMonth === day && 
             (month - 1) === currentDate.getMonth() && 
             year === currentDate.getFullYear();
    });
  };

  const pipelineData = useMemo(() => {
    const latestByPerson = {};
    
    // Find the absolute latest date for each person
    dates.forEach(d => {
      if (!d.name) return;
      const normalizedName = d.name.trim().toLowerCase();
      
      // If we haven't seen this person yet, or this date is newer
      if (!latestByPerson[normalizedName]) {
        latestByPerson[normalizedName] = d;
      } else {
        const currentDate = new Date(d.date + ' ' + (d.time || '00:00'));
        const existingDate = new Date(latestByPerson[normalizedName].date + ' ' + (latestByPerson[normalizedName].time || '00:00'));
        
        if (currentDate > existingDate) {
          latestByPerson[normalizedName] = d;
        }
      }
    });
  
    const grouped = {};
    DATE_NUMBERS.forEach(stage => grouped[stage] = []);
    
    // Only show people whose LATEST date doesn't have nextStep: 'End'
    Object.values(latestByPerson).forEach(personDate => {
      if (personDate.nextStep === 'End') return; // Filter out ended relationships
      
      const stage = personDate.dateNumber;
      if (grouped[stage]) {
        grouped[stage].push(personDate);
      } else {
        if (!grouped['4th+']) grouped['4th+'] = [];
        grouped['4th+'].push(personDate);
      }
    });
    
    return grouped;
  }, [dates]);

  return (
    <div className="flex flex-col h-full bg-gray-50 overflow-y-auto pb-16">
      <div className="bg-white px-6 pt-6 pb-3 shadow-sm flex justify-between items-center sticky top-0 z-10">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Your Journey</h2>
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">{dates.length} MEMORIES LOGGED</p>
        </div>
        <button onClick={onOpenAI} className="p-2 bg-indigo-50 text-indigo-600 rounded-full">
          <MessageCircle size={24} />
        </button>
      </div>

      <div className="bg-white mb-4 shadow-sm pb-4">
        <div className="flex justify-between items-center px-6 py-2">
          <button onClick={() => changeMonth(-1)} className="p-2 hover:bg-gray-100 rounded-full"><ChevronLeft size={20}/></button>
          <h3 className="font-semibold text-gray-800">{monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}</h3>
          <button onClick={() => changeMonth(1)} className="p-2 hover:bg-gray-100 rounded-full"><ChevronRight size={20}/></button>
        </div>

        <div className="grid grid-cols-7 gap-1 px-4">
          {['S','M','T','W','T','F','S'].map((d, i) => (
            <div key={`${d}-${i}`} className="text-center text-[10px] text-gray-400 font-bold py-2">{d}</div>
          ))}
          {Array(firstDay).fill(null).map((_, i) => <div key={`empty-${i}`} />)}
          {Array(days).fill(null).map((_, i) => {
            const day = i + 1;
            const dayDates = getDatesForDay(day);
            const hasDate = dayDates.length > 0;
            let colorClass = '';
            if (hasDate) {
              const d = dayDates[0];
              if (isFutureDate(d.date, d.time) || !d.feeling) {
                // Future date OR unlogged past date
                colorClass = SCHEDULED_THEME.color;
              } else {
                colorClass = FEELINGS[d.feeling]?.color || FEELINGS.OKAY.color;
              }
            }

            return (
              <div 
                key={day} 
                onClick={() => hasDate ? onSelectDate(dayDates[0]) : null}
                className={`aspect-square flex flex-col items-center justify-center rounded-lg text-sm relative cursor-pointer transition-all ${hasDate ? 'bg-white shadow-sm border border-gray-100' : 'text-gray-300 hover:bg-gray-50'}`}
              >
                <span className={`z-10 ${hasDate ? 'font-bold' : ''}`}>{day}</span>
                {hasDate && <div className={`absolute inset-0 rounded-lg opacity-20 ${colorClass}`}></div>}
                {hasDate && <div className={`w-1 h-1 rounded-full mt-1 ${colorClass.replace('bg-', 'bg-opacity-100 bg-')}`}></div>}
              </div>
            );
          })}
        </div>
      </div>

      <div className="px-6 space-y-4 mb-4">
        <div className="flex items-center justify-between">
           <h3 className="text-lg font-bold text-gray-800">Active Dates</h3>
           <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wide">Snapshot</span>
        </div>
        
        <div className="space-y-4">
          {DATE_NUMBERS.map((stage) => {
             const people = pipelineData[stage];
             if (!people || people.length === 0) return null;
             
             return (
               <div key={stage} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                 <div className="flex items-center gap-2 mb-3">
                   <div className="h-2 w-2 rounded-full bg-rose-400"></div>
                   <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide">{stage}</h4>
                 </div>
                 
                 <div className="space-y-3">
                    {people.map(person => {
                       const isFuture = isFutureDate(person.date, person.time);
                       const isUnlogged = !person.feeling;
                       const theme = (isFuture || isUnlogged) ? SCHEDULED_THEME : (FEELINGS[person.feeling] || FEELINGS.OKAY);
                       
                       return (
                        <div key={person.id} onClick={() => onSelectDate(person)} className="flex items-center justify-between group cursor-pointer">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-lg font-bold text-gray-600 border-2 border-white shadow-sm overflow-hidden relative">
                              {person.photo ? (
                                <img src={person.photo} alt="Profile" className="w-full h-full object-cover" />
                              ) : (
                                <span>{person.name ? person.name[0].toUpperCase() : '?'}</span>
                              )}
                            </div>
                            <div>
                              <p className="font-bold text-gray-800 text-sm">{person.name}</p>
                              <p className="text-xs text-gray-500">
                                {(() => {
                                  const [year, month, day] = person.date.split('-').map(Number);
                                  return new Date(year, month - 1, day).toLocaleDateString();
                                })()}
                              </p>
                            </div>
                          </div>
                          <div className={`px-2 py-1 rounded-md text-[10px] font-bold ${theme.color} bg-opacity-20 ${theme.text}`}>
                            {theme.label}
                          </div>
                        </div>
                      );
                    })}
                 </div>
               </div>
             );
          })}
          {Object.values(pipelineData).flat().length === 0 && (
             <div className="text-center py-8 text-gray-400 text-sm">
               No active dates in the pipeline.
             </div>
          )}
        </div>
      </div>

      <div className="fixed bottom-20 right-6 z-20">
        <button 
          onClick={onAddDate}
          className="bg-rose-500 text-white p-4 rounded-full shadow-lg shadow-rose-200 flex items-center gap-2 hover:bg-rose-600 transition-all active:scale-95"
        >
          <Plus size={24} />
          <span className="font-bold pr-1">Log Date</span>
        </button>
      </div>
    </div>
  );
};

// 4. Summary List Tab
const SummaryTab = ({ dates, onSelectDate }) => {
  const upcoming = dates.filter(d => isFutureDate(d.date, d.time));
  const past = dates.filter(d => !isFutureDate(d.date, d.time));

  const renderList = (list) => (
    list.map((d) => {
      const isFuture = isFutureDate(d.date, d.time);
      const isUnlogged = !d.feeling;
      const feeling = (isFuture || isUnlogged) ? SCHEDULED_THEME : (FEELINGS[d.feeling] || FEELINGS.OKAY);
      const scenario = SCENARIOS.find(s => s.id === d.scenario) || SCENARIOS[0];
      const ScenarioIcon = scenario.icon;
      const FeelingIcon = feeling.icon;
      
      return (
        <div 
          key={d.id} 
          onClick={() => onSelectDate(d)}
          className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4 active:bg-gray-50 transition-colors mb-3"
        >
          <div className={`w-12 h-12 rounded-full ${feeling.color} bg-opacity-20 flex items-center justify-center ${feeling.text} overflow-hidden shrink-0`}>
             {d.photo ? <img src={d.photo} className="w-full h-full object-cover" /> : <FeelingIcon size={20} />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex justify-between items-start">
              <h3 className="font-bold text-gray-800 truncate pr-2">{d.name}</h3>
              <div className="flex flex-col items-end gap-1">
                <span className="text-xs text-gray-400 whitespace-nowrap">{new Date(d.date).toLocaleDateString()}</span>
                <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${feeling.color} bg-opacity-20 ${feeling.text} whitespace-nowrap`}>
                  {feeling.label}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
              <span className="flex items-center gap-1 truncate"><ScenarioIcon size={12}/> {scenario.label}</span>
              <span>•</span>
              <span className="truncate">{d.dateNumber}</span>
            </div>
          </div>
          <ChevronRight size={16} className="text-gray-300 shrink-0" />
        </div>
      );
    })
  );

  return (
    <div className="h-full bg-gray-50 overflow-y-auto pb-16 pt-6">
       <div className="px-6 mb-3">
         <h2 className="text-2xl font-bold text-gray-800">Summary</h2>
         <p className="text-sm text-gray-500">Your dating history & upcoming plans</p>
       </div>
       
       <div className="px-4 space-y-6">
         {upcoming.length > 0 && (
           <div>
             <h3 className="text-xs font-bold text-blue-500 uppercase tracking-wide mb-3 pl-2 flex items-center gap-1">
               <Clock size={12} /> Upcoming Dates
             </h3>
             <div>{renderList(upcoming)}</div>
           </div>
         )}
         <div>
           <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3 pl-2">Past Memories</h3>
           {past.length > 0 ? renderList(past) : (
             <div className="text-center py-8 text-gray-400 text-sm bg-white rounded-xl border border-dashed border-gray-200">
               No past dates recorded yet.
             </div>
           )}
         </div>
       </div>
    </div>
  );
};


// 5. Profile Tab - allow user to create profile
const ProfileTab = ({ user, userProfile, onUpdateProfile }) => {
  const [view, setView] = useState(user?.isAnonymous ? 'upgrade' : 'profile');
  const [isSignup, setIsSignup] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Editing profile state
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(userProfile?.name || '');
  const [editBio, setEditBio] = useState(userProfile?.bio || '');
  const [editPhoto, setEditPhoto] = useState(userProfile?.photo || null);
  const fileInputRef = useRef(null);

  const handlePhotoUpload = async (e) => {
    if (e.target.files && e.target.files[0]) {
      try {
        const base64 = await resizeImage(e.target.files[0]);
        setEditPhoto(base64);
      } catch (err) {
        console.error("Image processing failed", err);
        alert("Could not process image.");
      }
    }
  };

  const handleSaveProfile = async () => {
    try {
      await onUpdateProfile({ name: editName, bio: editBio, photo: editPhoto });
      setIsEditing(false);
    } catch (e) {
      console.error("Error saving profile", e);
    }
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isSignup) {
        // Sign up new user
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCredential.user, { displayName: name });
        
        // Create user profile in Firestore
        await setDoc(doc(db, 'users', userCredential.user.uid), {
          name: name,
          email: email,
          createdAt: serverTimestamp()
        });
        
        alert('Account created! Please log your first date.');
        setView('profile');
      } else {
        // Log in existing user
        await signInWithEmailAndPassword(auth, email, password);
        alert('Welcome back!');
        setView('profile');
      }
    } catch (err) {
      if (err.code === 'auth/email-already-in-use') {
        setError('This email is already registered. Try logging in instead.');
      } else if (err.code === 'auth/weak-password') {
        setError('Password should be at least 6 characters.');
      } else if (err.code === 'auth/invalid-email') {
        setError('Please enter a valid email address.');
      } else if (err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
        setError('Invalid email or password.');
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    if (confirm("Are you sure you want to log out?")) {
      try {
        await signOut(auth);
        // Don't show alert, let the UI handle the transition
      } catch (e) {
        console.error("Logout error", e);
      }
    }
  };

  // If editing profile
  if (isEditing) {
    return (
      <div className="h-full bg-gray-50 overflow-y-auto pb-20">
        <div className="bg-white sticky top-0 z-10 px-4 py-4 shadow-sm flex justify-between items-center">
          <button onClick={() => setIsEditing(false)} className="text-gray-500 font-medium">Cancel</button>
          <h2 className="font-bold text-lg">Edit Profile</h2>
          <button onClick={handleSaveProfile} className="text-rose-600 font-bold">Save</button>
        </div>

        <div className="p-6 space-y-6">
          <div className="flex flex-col items-center">
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="w-32 h-32 rounded-full bg-gray-100 border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 cursor-pointer hover:bg-gray-50 overflow-hidden mb-4"
            >
              {editPhoto ? (
                <img src={editPhoto} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <>
                  <Camera size={32} className="mb-2" />
                  <span className="text-sm">Upload Photo</span>
                </>
              )}
            </div>
            <input type="file" ref={fileInputRef} onChange={handlePhotoUpload} accept="image/*" className="hidden" />
          </div>

          <div className="bg-white p-4 rounded-xl shadow-sm space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Name</label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full p-3 bg-gray-50 rounded-lg border-none focus:ring-2 focus:ring-rose-200"
                placeholder="Your name"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Bio</label>
              <textarea
                value={editBio}
                onChange={(e) => setEditBio(e.target.value)}
                className="w-full p-3 bg-gray-50 rounded-lg border-none focus:ring-2 focus:ring-rose-200 h-32 resize-none"
                placeholder="Tell us about yourself..."
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // If anonymous user - show upgrade prompt
  if (view === 'upgrade') {
    return (
      <div className="h-full bg-gray-50 overflow-y-auto pb-20">
        <div className="px-6 pt-8 pb-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Create Your Account</h2>
          <p className="text-sm text-gray-500">Save your data across devices with an email account</p>
        </div>

        <div className="px-6 space-y-4">
          <div className="bg-gradient-to-r from-rose-500 to-pink-500 p-1 rounded-xl">
            <div className="bg-white p-4 rounded-lg">
              <h3 className="font-bold text-gray-800 mb-2">Why create an account?</h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-start gap-2">
                  <CheckCircle size={16} className="text-green-500 mt-0.5 shrink-0" />
                  <span>Access your dates from any device</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle size={16} className="text-green-500 mt-0.5 shrink-0" />
                  <span>Never lose your data</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle size={16} className="text-green-500 mt-0.5 shrink-0" />
                  <span>Secure cloud backup</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setIsSignup(true)}
              className={`flex-1 py-2 rounded-lg font-semibold transition-colors ${isSignup ? 'bg-rose-500 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}
            >
              Sign Up
            </button>
            <button
              onClick={() => setIsSignup(false)}
              className={`flex-1 py-2 rounded-lg font-semibold transition-colors ${!isSignup ? 'bg-rose-500 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}
            >
              Log In
            </button>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            {isSignup && (
              <input
                type="text"
                placeholder="Your Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full p-3 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-rose-200 focus:border-transparent"
                required
              />
            )}
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-3 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-rose-200 focus:border-transparent"
              required
            />
            <input
              type="password"
              placeholder="Password (min 6 characters)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-rose-200 focus:border-transparent"
              required
              minLength={6}
            />
            
            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-600 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-rose-500 text-white rounded-xl font-bold shadow-lg hover:bg-rose-600 transition-colors disabled:opacity-50"
            >
              {loading ? 'Please wait...' : (isSignup ? 'Create Account' : 'Log In')}
            </button>
          </form>

          <div className="text-center">
            <button
              onClick={() => setView('profile')}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Continue as anonymous user
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Regular profile view for logged-in users
  return (
    <div className="h-full bg-gray-50 overflow-y-auto pb-16 pt-6">
      <div className="px-6 mb-3">
        <h2 className="text-2xl font-bold text-gray-800">Profile</h2>
        <p className="text-sm text-gray-500">Manage your account</p>
      </div>

      <div className="px-6 space-y-3">
        <div className="bg-white rounded-xl p-6 shadow-sm text-center">
          <div className="w-24 h-24 mx-auto rounded-full bg-gray-100 flex items-center justify-center text-3xl mb-4 overflow-hidden border-4 border-white shadow-lg">
            {userProfile?.photo ? (
              <img src={userProfile.photo} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <User className="w-12 h-12 text-gray-400" />
            )}
          </div>
          <h3 className="text-xl font-bold text-gray-800">{userProfile?.name || user?.displayName || 'Anonymous User'}</h3>
          {user?.email && <p className="text-sm text-gray-500 mt-1">{user.email}</p>}
          {!user?.email && <p className="text-sm text-gray-500 mt-1">Anonymous account</p>}
          {userProfile?.bio && (
            <p className="text-sm text-gray-600 mt-4 leading-relaxed">{userProfile.bio}</p>
          )}
        </div>

        {user?.email && (
          <button
            onClick={() => setIsEditing(true)}
            className="w-full py-4 bg-rose-500 text-white rounded-xl font-bold hover:bg-rose-600 transition-colors"
          >
            Edit Profile
          </button>
        )}

        {user?.isAnonymous && (
          <button
            onClick={() => setView('upgrade')}
            className="w-full py-4 bg-rose-500 text-white rounded-xl font-bold hover:bg-rose-600 transition-colors"
          >
            Create Account
          </button>
        )}

        {user?.email && (
          <button
            onClick={handleLogout}
            className="w-full py-4 bg-white text-gray-600 border border-gray-200 rounded-xl font-semibold hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
          >
            <Lock size={20} />
            Log Out
          </button>
        )}

        <div className="bg-white rounded-xl p-4 shadow-sm">
          <h4 className="text-sm font-bold text-gray-700 mb-3">About This App</h4>
          <p className="text-sm text-gray-600 leading-relaxed">
          DatingToday helps you track, reflect, and learn from your dating experiences. Keep a private journal of your dates, spot patterns, and date more mindfully.
          </p>
        </div>
      </div>
    </div>
  );
};


// 6. Add/Edit Date Form
const DateForm = ({ initialData, onSave, onCancel, onOpenAI, existingDates = [] }) => {
  const [formData, setFormData] = useState(() => {
    if (initialData) return initialData;
    
    // For new dates, check if it's in the future
    const now = new Date();
    const defaultDate = new Date().toLocaleDateString('en-CA');
    const defaultTime = new Date().toTimeString().slice(0, 5);
    
    return {
      date: defaultDate,
      time: defaultTime,
      name: '',
      title: '',
      link: '',
      photo: null,
      dateNumber: 'First date',
      scenario: 'coffee',
      // Don't set feeling, tags, diary, or nextStep - let them be undefined for future dates
      // They'll only be set when the user actually logs the date
      feeling: undefined,
      tags: [],
      diaryFeel: '',
      diaryAttraction: '',
      nextStep: undefined
    };
  });

  const [showDropdown, setShowDropdown] = useState(false);
  const fileInputRef = useRef(null);
  const isFuture = isFutureDate(formData.date, formData.time);
  const isEditing = !!initialData?.id;

  // Get unique active dates (people who aren't ended)
  const activePeople = useMemo(() => {
    const latestByPerson = {};
    existingDates.forEach(d => {
      if (!d.name) return;
      const normalizedName = d.name.trim().toLowerCase();
      if (!latestByPerson[normalizedName] || new Date(d.date) > new Date(latestByPerson[normalizedName].date)) {
        latestByPerson[normalizedName] = d;
      }
    });
    
    // Filter out people who have been ended
    return Object.values(latestByPerson).filter(person => person.nextStep !== 'End');
  }, [existingDates]);

  const toggleTag = (tag) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.includes(tag) 
        ? prev.tags.filter(t => t !== tag)
        : [...prev.tags, tag]
    }));
  };

  const handlePhotoUpload = async (e) => {
    if (e.target.files && e.target.files[0]) {
      try {
        const base64 = await resizeImage(e.target.files[0]);
        setFormData(prev => ({ ...prev, photo: base64 }));
      } catch (err) {
        console.error("Image processing failed", err);
        alert("Could not process image.");
      }
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  // Handle selecting a person from the dropdown
  const handleSelectPerson = (person) => {
    setFormData(prev => ({
      ...prev,
      name: person.name,
      title: person.title || '',
      link: person.link || '',
      photo: person.photo || null,
      // Don't auto-fill scenario, feeling, tags, diary, nextStep - those are specific to this date
    }));
    setShowDropdown(false);
  };

  return (
    <div className="h-full bg-gray-50 overflow-y-auto pb-20">
      <div className="bg-white sticky top-0 z-10 px-4 py-4 shadow-sm flex justify-between items-center">
        <button onClick={onCancel} className="text-gray-500 font-medium">Cancel</button>
        <h2 className="font-bold text-lg">{isEditing ? 'Edit Date' : 'Log a Date'}</h2>
        <button onClick={handleSubmit} className="text-rose-600 font-bold">{isEditing ? 'Update' : 'Save'}</button>
      </div>

      <div className="p-4 space-y-6">
        <div className="bg-white p-4 rounded-xl shadow-sm space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Date</label>
              <input 
                type="date" 
                value={formData.date}
                onChange={e => setFormData({...formData, date: e.target.value})}
                className="w-full p-2 bg-gray-50 rounded-lg border-none focus:ring-2 focus:ring-rose-200"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Time</label>
              <input 
                type="time" 
                value={formData.time}
                onChange={e => setFormData({...formData, time: e.target.value})}
                className="w-full p-2 bg-gray-50 rounded-lg border-none focus:ring-2 focus:ring-rose-200"
              />
            </div>
          </div>
          {isFuture && (
            <div className="flex items-center gap-2 text-blue-600 bg-blue-50 p-2 rounded-lg text-sm">
               <Clock size={16} />
               <span>Marked as Scheduled Date</span>
            </div>
          )}
        </div>

        <div className="bg-white p-4 rounded-xl shadow-sm space-y-4">
          <h3 className="flex items-center gap-2 font-semibold text-gray-800">
            <User size={18} className="text-rose-500" /> The Date
          </h3>
          <div className="flex items-center gap-4">
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="w-20 h-20 rounded-full bg-gray-100 border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 cursor-pointer hover:bg-gray-50 overflow-hidden relative"
            >
              {formData.photo ? (
                <img src={formData.photo} alt="Preview" className="w-full h-full object-cover" />
              ) : (
                <>
                  <Camera size={20} className="mb-1" />
                  <span className="text-[9px]">Upload</span>
                </>
              )}
            </div>
            <input type="file" ref={fileInputRef} onChange={handlePhotoUpload} accept="image/*" className="hidden" />
            
            <div className="flex-1 space-y-2">
              {/* Name input with dropdown */}
              <div className="relative">
                <div className="flex gap-2">
                  <input 
                    placeholder="Name / Nickname"
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                    className="flex-1 p-3 bg-gray-50 rounded-lg border-none focus:ring-2 focus:ring-rose-200"
                  />
                  {activePeople.length > 0 && !isEditing && (
                    <button
                      type="button"
                      onClick={() => setShowDropdown(!showDropdown)}
                      className="px-3 bg-gray-50 rounded-lg border-none hover:bg-gray-100 transition-colors flex items-center gap-1"
                    >
                      <List size={18} className="text-gray-500" />
                    </button>
                  )}
                </div>
                
                {/* Dropdown menu */}
                {showDropdown && activePeople.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 max-h-48 overflow-y-auto">
                    <div className="p-2">
                      <p className="text-xs font-bold text-gray-400 uppercase px-2 py-1">Select from active dates</p>
                      {activePeople.map((person, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleSelectPerson(person)}
                          className="w-full flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg transition-colors"
                        >
                          <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-sm font-bold text-gray-600 overflow-hidden shrink-0">
                            {person.photo ? (
                              <img src={person.photo} alt={person.name} className="w-full h-full object-cover" />
                            ) : (
                              <span>{person.name[0].toUpperCase()}</span>
                            )}
                          </div>
                          <div className="flex-1 text-left">
                            <p className="font-semibold text-gray-800 text-sm">{person.name}</p>
                            {person.title && <p className="text-xs text-gray-500">{person.title}</p>}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              
              <input 
                placeholder="Title (e.g. The Architect)"
                value={formData.title}
                onChange={e => setFormData({...formData, title: e.target.value})}
                className="w-full p-3 bg-gray-50 rounded-lg border-none focus:ring-2 focus:ring-rose-200 text-sm"
              />
            </div>
          </div>
          <input 
            placeholder="Link to profile (optional)"
            value={formData.link}
            onChange={e => setFormData({...formData, link: e.target.value})}
            className="w-full p-3 bg-gray-50 rounded-lg border-none focus:ring-2 focus:ring-rose-200 text-sm"
          />
          <select 
            value={formData.dateNumber}
            onChange={e => setFormData({...formData, dateNumber: e.target.value})}
            className="w-full p-3 bg-gray-50 rounded-lg border-none focus:ring-2 focus:ring-rose-200"
          >
            {DATE_NUMBERS.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-sm space-y-4">
          <h3 className="flex items-center gap-2 font-semibold text-gray-800">
            <MapPin size={18} className="text-rose-500" /> Scenario
          </h3>
          <div className="grid grid-cols-4 gap-2">
            {SCENARIOS.map(s => {
              const Icon = s.icon;
              const isSelected = formData.scenario === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setFormData({...formData, scenario: s.id})}
                  className={`flex flex-col items-center p-3 rounded-lg border h-20 justify-center gap-1 transition-all ${isSelected ? 'border-rose-500 bg-rose-50 text-rose-600' : 'border-gray-100 text-gray-400'}`}
                >
                  <Icon size={20} />
                  <span className="text-[10px] font-medium leading-tight text-center">{s.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {!isFuture && (
          <div className="bg-white p-4 rounded-xl shadow-sm space-y-4">
            <h3 className="flex items-center gap-2 font-semibold text-gray-800">
              <Heart size={18} className="text-rose-500" /> Overall Feeling
            </h3>
            <div className="grid grid-cols-5 gap-2">
            {Object.keys(FEELINGS).map(key => {
  const f = FEELINGS[key];
  const isSelected = formData.feeling === key || (!formData.feeling && key === 'OKAY'); // Default to OKAY visually, but don't save it
                const FeelingIcon = f.icon;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setFormData({...formData, feeling: key})}
                    className={`flex flex-col items-center py-2 rounded-lg transition-all ${isSelected ? 'ring-2 ring-offset-1 ring-gray-400 scale-105' : 'opacity-60 grayscale'}`}
                  >
                    <div className={`w-10 h-10 ${f.color} rounded-full flex items-center justify-center mb-1 text-white shadow-sm`}>
                      <FeelingIcon size={20} />
                    </div>
                    <span className="text-[10px] font-medium text-gray-600">{f.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {!isFuture && (
          <div className="bg-white p-4 rounded-xl shadow-sm space-y-4">
            <h3 className="font-semibold text-gray-800">Why? (Highlights)</h3>
            <div className="flex flex-wrap gap-2">
              {TAGS.map(tag => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${formData.tags.includes(tag) ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-600 border-gray-200'}`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        )}

        {!isFuture && (
          <div className="bg-white p-4 rounded-xl shadow-sm space-y-4">
            <h3 className="flex items-center gap-2 font-semibold text-gray-800">
              <ArrowRight size={18} className="text-rose-500" /> Next Step
            </h3>
            <div className="grid grid-cols-3 gap-2">
            {NEXT_STEPS.map(step => {
   const isSelected = formData.nextStep === step.id || (!formData.nextStep && step.id === 'Unsure'); // Default to Unsure visually, but don't save it
                 const StepIcon = step.icon;
                 return (
                   <button
                     key={step.id}
                     type="button"
                     onClick={() => setFormData({...formData, nextStep: step.id})}
                     className={`flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all ${isSelected ? step.color : 'border-gray-100 text-gray-400 bg-white'}`}
                   >
                     <StepIcon size={20} className="mb-1"/>
                     <span className="text-xs font-bold">{step.label}</span>
                   </button>
                 )
              })}
            </div>
          </div>
        )}

        {!isFuture && (
          <div className="bg-white p-4 rounded-xl shadow-sm space-y-4">
            <h3 className="flex items-center gap-2 font-semibold text-gray-800">
              <Edit2 size={18} className="text-rose-500" /> Diary
            </h3>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">How did you feel right after?</label>
              <textarea 
                value={formData.diaryFeel}
                onChange={e => setFormData({...formData, diaryFeel: e.target.value})}
                className="w-full p-3 bg-gray-50 rounded-lg border-none focus:ring-2 focus:ring-rose-200 text-sm h-24 resize-none"
                placeholder="I felt relived, excited..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">What attracted you? What didn't?</label>
              <textarea 
                value={formData.diaryAttraction}
                onChange={e => setFormData({...formData, diaryAttraction: e.target.value})}
                className="w-full p-3 bg-gray-50 rounded-lg border-none focus:ring-2 focus:ring-rose-200 text-sm h-24 resize-none"
                placeholder="His sense of humor was great, but..."
              />
            </div>
          </div>
        )}

        <div className="bg-gradient-to-r from-indigo-500 to-purple-600 p-1 rounded-xl shadow-lg transform hover:scale-[1.01] transition-transform cursor-pointer" onClick={onOpenAI}>
          <div className="bg-white p-4 rounded-lg flex items-center justify-between">
            <div>
              <h4 className="font-bold text-gray-800 flex items-center gap-2">
                <MessageCircle size={16} className="text-indigo-600"/> 
                Need advice?
              </h4>
              <p className="text-xs text-gray-500">Talk to our AI dating expert</p>
            </div>
            <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center">
              <ChevronRight size={16} className="text-indigo-600" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};



// 7. Date Detail View
const DateDetail = ({ data, onBack, onDelete, onEndDating, onEdit }) => {
  const isFuture = isFutureDate(data.date, data.time);
  const feeling = isFuture ? SCHEDULED_THEME : (FEELINGS[data.feeling] || FEELINGS.OKAY);
  const scenario = SCENARIOS.find(s => s.id === data.scenario) || SCENARIOS[0];
  const ScenarioIcon = scenario.icon;
  const FeelingIcon = feeling.icon;
  const nextStep = NEXT_STEPS.find(n => n.id === data.nextStep) || NEXT_STEPS[2];

  return (
    <div className="h-full bg-white flex flex-col">
      <div className="px-6 py-6 border-b flex justify-between items-center bg-white sticky top-0 z-10">
        <button onClick={onBack} className="p-2 -ml-2 hover:bg-gray-100 rounded-full">
          <ChevronLeft className="text-gray-600" />
        </button>
        <div className="flex gap-2">
          <button onClick={() => onEdit(data)} className="p-2 text-indigo-500 hover:bg-indigo-50 rounded-full">
            <Edit2 size={20} />
          </button>
          <button onClick={() => onDelete(data.id)} className="p-2 text-rose-500 hover:bg-rose-50 rounded-full">
            <Trash2 size={20} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        <div className="text-center space-y-2">
          <div className="w-24 h-24 mx-auto rounded-full bg-gray-100 flex items-center justify-center text-3xl mb-4 overflow-hidden border-4 border-white shadow-lg relative">
             {data.photo ? (
               <img src={data.photo} alt={data.name} className="w-full h-full object-cover" />
             ) : (
               <span className="text-gray-400">{data.name ? data.name[0].toUpperCase() : '?'}</span>
             )}
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{data.name}</h1>
          <p className="text-indigo-600 font-medium">{data.title}</p>
          <div className="flex justify-center gap-2 text-sm text-gray-500">
             <span>{new Date(data.date).toLocaleDateString()}</span>
             <span>•</span>
             <span>{data.dateNumber}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className={`p-4 rounded-2xl ${feeling.color} bg-opacity-20 flex flex-col items-center justify-center text-center gap-1`}>
             <FeelingIcon className={`mb-1 ${feeling.text}`} />
             <span className={`font-bold ${feeling.text}`}>{feeling.label}</span>
          </div>
          <div className="p-4 rounded-2xl bg-gray-50 flex flex-col items-center justify-center text-center gap-1">
             <ScenarioIcon className="mb-1 text-gray-600" />
             <span className="font-bold text-gray-600">{scenario.label}</span>
          </div>
        </div>
        
        <div className="bg-gray-50 p-4 rounded-xl flex items-center justify-between">
           <span className="text-sm font-semibold text-gray-500">Next Step Decision</span>
           <span className={`px-3 py-1 rounded-full text-xs font-bold border ${nextStep.color}`}>
             {nextStep.label}
           </span>
        </div>

        {data.tags && data.tags.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide">Highlights</h3>
            <div className="flex flex-wrap gap-2">
              {data.tags.map(tag => (
                <span key={tag} className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-sm">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-6">
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide">Post-Date Feeling</h3>
            <p className="text-gray-700 leading-relaxed bg-rose-50 p-4 rounded-xl">
              {data.diaryFeel || "No entry..."}
            </p>
          </div>
          
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide">Attraction Notes</h3>
            <p className="text-gray-700 leading-relaxed bg-indigo-50 p-4 rounded-xl">
              {data.diaryAttraction || "No entry..."}
            </p>
          </div>
        </div>
        
        <div className="pt-8 pb-4">
           <button 
             onClick={() => onEndDating(data)}
             className="w-full py-4 border-2 border-rose-100 text-rose-500 font-bold rounded-xl hover:bg-rose-50 transition-colors"
           >
             End Dating
           </button>
        </div>
      </div>
    </div>
  );
};

// 8. Paywall / Premium Screen
const PremiumScreen = ({ type, onUpgrade, onCancel, showTabs, dates = [] }) => {
  const stats = useMemo(() => {
    if (!dates.length) return null;
    const nameCounts = {};
    dates.forEach(d => {
       if(d.name && d.feeling && (d.feeling === 'GOOD' || d.feeling === 'EXCELLENT')) {
          const n = d.name.trim();
          nameCounts[n] = (nameCounts[n] || 0) + 1;
       }
    });
    const topName = Object.keys(nameCounts).reduce((a, b) => nameCounts[a] > nameCounts[b] ? a : b, '');
    const tagCounts = {};
    dates.forEach(d => {
      if(d.tags) d.tags.forEach(t => tagCounts[t] = (tagCounts[t] || 0) + 1);
    });
    const topTag = Object.keys(tagCounts).reduce((a, b) => tagCounts[a] > tagCounts[b] ? a : b, '');
    return { topName: topName || 'N/A', topTag: topTag || 'N/A' };
  }, [dates]);

  return (
    <div className="h-full bg-gray-900 text-white flex flex-col relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-indigo-900 via-purple-900 to-gray-900 z-0 opacity-50"></div>
      <div className={`z-10 flex-1 flex flex-col items-center justify-center text-center space-y-6 p-8 ${showTabs ? 'pb-24 pt-12' : ''} overflow-y-auto`}>
        {type === 'expert' && stats && (
          <div className="w-full bg-white/10 backdrop-blur-md rounded-2xl p-4 mb-4 border border-white/10 text-left">
            <h3 className="text-xs font-bold text-indigo-300 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Activity size={14} /> Your Dating Insights
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-400 mb-1">Top Connection</p>
                <p className="font-bold text-lg text-white">{stats.topName}</p>
              </div>
              <div>
                 <p className="text-xs text-gray-400 mb-1">Favorite Trait</p>
                 <p className="font-bold text-lg text-white">{stats.topTag}</p>
              </div>
            </div>
          </div>
        )}
        <div className="w-20 h-20 bg-gradient-to-tr from-yellow-400 to-orange-500 rounded-2xl flex items-center justify-center shadow-2xl mb-4 transform rotate-6 shrink-0">
          {type === 'limit' ? <Lock size={40} className="text-white" /> : <MessageCircle size={40} className="text-white" />}
        </div>
        <h2 className="text-3xl font-bold">
          {type === 'limit' ? 'Unlock Unlimited Dates' : 'Ask the Date Expert'}
        </h2>
        <p className="text-gray-300 text-lg leading-relaxed">
          {type === 'limit' ? "You've hit the 10-date limit. Upgrade to track your entire dating journey without restrictions." : "Get AI-powered advice, pattern analysis, and next date ideas with our Date Expert."}
        </p>
        <div className="w-full space-y-3 pt-8 shrink-0">
           <button onClick={onUpgrade} className="w-full py-4 bg-white text-gray-900 rounded-xl font-bold text-lg hover:bg-gray-100 transition-colors">Become a Platinum Member</button>
          {onCancel && <button onClick={onCancel} className="text-gray-400 py-2">Maybe Later</button>}
        </div>
      </div>
    </div>
  );
};

// 9. Main Screen Wrapper
const MainScreen = ({ 
  dates, 
  onSelectDate, 
  onAddDate, 
  activeTab, 
  onTabChange, 
  onOpenAI, 
  isPremium, 
  onUpgrade,
  user,              // ADD
  userProfile,       // ADD
  onUpdateProfile    // ADD
}) => {
  return (
    <div className="h-full flex flex-col bg-gray-50">
      <div className="flex-1 overflow-hidden relative">
        {activeTab === 'journey' && <JourneyTab dates={dates} onSelectDate={onSelectDate} onAddDate={onAddDate} onOpenAI={onOpenAI} />}
        {activeTab === 'summary' && <SummaryTab dates={dates} onSelectDate={onSelectDate} />}
        {activeTab === 'expert' && <PremiumScreen type="expert" onUpgrade={onUpgrade} showTabs={true} dates={dates} />}
        {activeTab === 'profile' && <ProfileTab user={user} userProfile={userProfile} onUpdateProfile={onUpdateProfile} />}
      </div>
      <div className="h-16 bg-white border-t border-gray-100 flex items-center justify-around px-2 z-30">
        <button onClick={() => onTabChange('journey')} className={`flex flex-col items-center p-2 rounded-lg transition-colors w-16 ${activeTab === 'journey' ? 'text-rose-500' : 'text-gray-400 hover:text-gray-600'}`}>
          <Home size={24} className="mb-1" strokeWidth={activeTab === 'journey' ? 2.5 : 2} />
          <span className="text-[10px] font-medium">Journey</span>
        </button>
        <button onClick={() => onTabChange('summary')} className={`flex flex-col items-center p-2 rounded-lg transition-colors w-16 ${activeTab === 'summary' ? 'text-rose-500' : 'text-gray-400 hover:text-gray-600'}`}>
          <List size={24} className="mb-1" strokeWidth={activeTab === 'summary' ? 2.5 : 2} />
          <span className="text-[10px] font-medium">Summary</span>
        </button>
        <button onClick={() => onTabChange('expert')} className={`flex flex-col items-center p-2 rounded-lg transition-colors w-16 ${activeTab === 'expert' ? 'text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}>
          <MessageCircle size={24} className="mb-1" strokeWidth={activeTab === 'expert' ? 2.5 : 2} />
          <span className="text-[10px] font-medium">Expert</span>
        </button>
        <button onClick={() => onTabChange('profile')} className={`flex flex-col items-center p-2 rounded-lg transition-colors w-16 ${activeTab === 'profile' ? 'text-rose-500' : 'text-gray-400 hover:text-gray-600'}`}>
          <User size={22} className="mb-1" strokeWidth={activeTab === 'profile' ? 2.5 : 2} />
          <span className="text-[10px] font-medium">Profile</span>
        </button>
      </div>
    </div>
  );
};

// --- Main App Component ---
export default function App() {
  const [user, setUser] = useState(null);
  const [dates, setDates] = useState([]);
  const [currentView, setCurrentView] = useState('loading');
  const [activeTab, setActiveTab] = useState('journey');
  const [selectedDate, setSelectedDate] = useState(null);
  const [paywallType, setPaywallType] = useState('limit');
  const [isPremium, setIsPremium] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  const [scheduledDateToLog, setScheduledDateToLog] = useState(null);


  // Dynamic viewport height fix for Chrome
  useEffect(() => {
    const setVH = () => {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
    };
    
    setVH();
    window.addEventListener('resize', setVH);
    window.addEventListener('orientationchange', setVH);
    
    return () => {
      window.removeEventListener('resize', setVH);
      window.removeEventListener('orientationchange', setVH);
    };
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        // User is signed in (either anonymous or email)
        setUser(currentUser);
      } else {
        // No user - sign in anonymously
        signInAnonymously(auth).catch(error => {
          console.error("Anonymous sign-in failed:", error);
        });
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      // When there's no user, reset to loading state
      setCurrentView('loading');
      setDates([]);
      return;
    }
    
    const q = query(collection(db, 'artifacts', appId, 'users', user.uid, 'dates'), orderBy('date', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const datesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setDates(datesData);
      
      if (currentView === 'loading') {
        // Check for past scheduled dates first
        const pastScheduled = checkForPastScheduledDates(datesData);
        
        if (pastScheduled) {
          setScheduledDateToLog(pastScheduled);
          setCurrentView('scheduled-reminder');
        } else if (datesData.length === 0) {
          setCurrentView('welcome');
        } else {
          setCurrentView('main');
        }
      }
    }, (error) => console.error("Error fetching dates:", error));
    return () => unsubscribe();
  }, [user, currentView]);
   
  // add for profile
  useEffect(() => {
    if (!user) return;
    
    // Load user profile from Firestore
    const loadProfile = async () => {
      try {
        const docSnap = await getDoc(doc(db, 'users', user.uid));
        if (docSnap.exists()) {
          setUserProfile(docSnap.data());
        }
      } catch (e) {
        console.error("Error loading profile", e);
      }
    };
    
    loadProfile();
  }, [user]);

  const handleWelcomeAnswer = (hasDated) => {
    if (hasDated) setCurrentView('add');
    else setCurrentView('main');
  };

  const handleSaveDate = async (formData) => {
    if (formData.id) {
       try {
         const { id, ...data } = formData;
         await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'dates', id), {
           ...data,
           reminderShown: true,  // NEW: Mark reminder as shown when user logs the date
           updatedAt: serverTimestamp()
         });
         setCurrentView('main');
       } catch (e) { console.error("Error updating date", e); }
       return;
    }
    try {
      // Only save fields that are actually set (not undefined)
      const dataToSave = Object.entries(formData).reduce((acc, [key, value]) => {
        if (value !== undefined) {
          acc[key] = value;
        }
        return acc;
      }, {});
      
      await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'dates'), {
        ...dataToSave,
        createdAt: serverTimestamp()
      });
      setCurrentView('main');
      setActiveTab('journey');
    } catch (e) { console.error("Error adding date", e); }
  };

  const handleDeleteDate = async (id) => {
    if (confirm("Are you sure you want to delete this memory?")) {
      try {
        await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'dates', id));
        setCurrentView('main');
      } catch (e) { console.error("Error deleting", e); }
    }
  };

  const handleEndDating = async (data) => {
    if (confirm(`Are you sure you want to end dating with ${data.name}? This will remove them from your active pipeline.`)) {
      try {
        await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'dates', data.id), { nextStep: 'End' });
        setCurrentView('main');
        setActiveTab('journey');
      } catch (e) { console.error("Error ending dating", e); }
    }
  }

  const handleUpgrade = () => {
    setIsPremium(true);
    alert("Welcome to Platinum! You now have unlimited logs and AI access.");
    if (currentView === 'paywall') setCurrentView('main');
  };

  const handleOpenAI = () => {
    setPaywallType('expert');
    setCurrentView('paywall');
  };

  const handleEdit = (dateData) => {
    setSelectedDate(dateData);
    setCurrentView('edit');
  };

  // add for profile
  const handleUpdateProfile = async (profileData) => {
    try {
      await setDoc(doc(db, 'users', user.uid), {
        ...profileData,
        email: user.email,
        updatedAt: serverTimestamp()
      }, { merge: true });
      
      if (profileData.name && user) {
        await updateProfile(user, { displayName: profileData.name });
      }
      
      setUserProfile({ ...profileData, email: user.email });
    } catch (e) {
      console.error("Error updating profile", e);
      alert("Could not save profile. Please try again.");
    }
  };
  
  // add for scheduled date ask page
  const handleLogScheduledDate = () => {
    // Pre-fill the form with the scheduled date info
    setSelectedDate(scheduledDateToLog);
    setScheduledDateToLog(null);
    setCurrentView('edit'); // Use 'edit' view to pre-fill the form
  };
  
  const handleSkipScheduledDate = async () => {
    // Mark this date's reminder as shown so it doesn't appear again
    if (scheduledDateToLog?.id) {
      try {
        await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'dates', scheduledDateToLog.id), {
          reminderShown: true
        });
      } catch (e) {
        console.error("Error marking reminder as shown", e);
      }
    }
    
    setScheduledDateToLog(null);
    setCurrentView('main');
  };


  // add for date reminder welcome page
  const checkForPastScheduledDates = (datesData) => {
    const now = new Date();
    console.log('🔍 Checking for past scheduled dates...');
    console.log('Current time:', now);
    console.log('Total dates:', datesData.length);
    
    const pastScheduledDates = datesData.filter(d => {
      if (!d.date || !d.time) return false;
      
      const [year, month, day] = d.date.split('-').map(Number);
      const [hour, minute] = d.time.split(':').map(Number);
      const dateTime = new Date(year, month - 1, day, hour, minute);
      
      console.log('Checking date:', {
        name: d.name,
        dateTime: dateTime,
        hasPassed: dateTime < now,
        feeling: d.feeling,
        nextStep: d.nextStep,
        reminderShown: d.reminderShown,
        notLogged: !d.feeling && !d.nextStep,
        reminderNotShown: !d.reminderShown
      });
      
      const hasPassed = dateTime < now;
      const notLogged = !d.feeling && !d.nextStep;
      const reminderNotShown = !d.reminderShown;
      
      return hasPassed && notLogged && reminderNotShown;
    });
    
    console.log('Found past scheduled dates:', pastScheduledDates.length);
    if (pastScheduledDates.length > 0) {
      console.log('Past scheduled dates:', pastScheduledDates);
    }
    
    // Return the most recent past scheduled date
    if (pastScheduledDates.length > 0) {
      pastScheduledDates.sort((a, b) => new Date(b.date) - new Date(a.date));
      console.log('✅ Returning scheduled date:', pastScheduledDates[0]);
      return pastScheduledDates[0];
    }
    
    console.log('❌ No past scheduled dates found');
    return null;
  };
  
  const renderContent = () => {
    if (!user) return <div className="flex items-center justify-center h-full text-rose-500">Loading...</div>;
    switch (currentView) {
      case 'scheduled-reminder': return scheduledDateToLog ? (
        <ScheduledDateReminderScreen 
          scheduledDate={scheduledDateToLog} 
          onLogDate={handleLogScheduledDate} 
          onSkip={handleSkipScheduledDate} 
        />
      ) : null;
      case 'welcome': return <WelcomeScreen onAnswer={handleWelcomeAnswer} />;
      case 'main': return (
        <MainScreen 
          dates={dates} 
          onSelectDate={(d) => { setSelectedDate(d); setCurrentView('detail'); }} 
          onAddDate={() => setCurrentView('add')} 
          activeTab={activeTab} 
          onTabChange={setActiveTab} 
          onOpenAI={handleOpenAI} 
          isPremium={isPremium} 
          onUpgrade={handleUpgrade}
          user={user}
          userProfile={userProfile}
          onUpdateProfile={handleUpdateProfile}
        />
      );
      case 'add': return <DateForm onSave={handleSaveDate} onCancel={() => setCurrentView('main')} onOpenAI={handleOpenAI} isPremium={isPremium} existingDates={dates} />;
      case 'edit': return <DateForm initialData={selectedDate} onSave={handleSaveDate} onCancel={() => setCurrentView('main')} onOpenAI={handleOpenAI} isPremium={isPremium} existingDates={dates} />;
      case 'detail': return selectedDate ? <DateDetail data={selectedDate} onBack={() => setCurrentView('main')} onDelete={handleDeleteDate} onEndDating={handleEndDating} onEdit={handleEdit} /> : null;
      case 'paywall': return <PremiumScreen type={paywallType} onUpgrade={handleUpgrade} onCancel={() => setCurrentView('main')} showTabs={false} dates={dates} />;
      default: return <div className="flex items-center justify-center h-full text-rose-500">Loading...</div>;
    }
  };

  return (
    <div 
      className="w-full max-w-md mx-auto bg-white shadow-2xl font-sans text-gray-900 flex flex-col border-x border-gray-100"
      style={{
        height: 'calc(var(--vh, 1vh) * 100)',
        maxHeight: 'calc(var(--vh, 1vh) * 100)'
      }}
    >
      <div className="h-1 w-full bg-rose-500 flex-shrink-0"></div>
      <div className="flex-1 overflow-hidden min-h-0">
        {renderContent()}
      </div>
    </div>
  );
}
