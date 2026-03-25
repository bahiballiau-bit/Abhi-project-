import React, { useState, useEffect } from 'react';
import { 
  ShoppingBag, 
  Utensils, 
  LayoutDashboard, 
  ChevronRight, 
  Plus, 
  Minus, 
  Trash2, 
  Clock, 
  CheckCircle2, 
  XCircle,
  Menu as MenuIcon,
  X,
  MapPin,
  CreditCard,
  TrendingUp,
  Users,
  Package,
  Edit2,
  Upload,
  Camera,
  User,
  LogIn,
  LogOut,
  Loader2,
  ChevronLeft,
  ChefHat,
  Star
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Category, MenuItem, CartItem, Order, View, UserProfile, Review } from './types';
import { auth, db } from './firebase';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  doc, 
  query, 
  orderBy, 
  getDocs, 
  setDoc, 
  getDoc, 
  deleteDoc, 
  serverTimestamp,
  Timestamp,
  where,
  getDocFromServer
} from 'firebase/firestore';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
  User as FirebaseUser
} from 'firebase/auth';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if(error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration. ");
    }
    // Skip logging for other errors, as this is simply a connection test.
  }
}
testConnection();

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: any;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      let errorMessage = "Something went wrong. Please try again later.";
      try {
        if (this.state.error && this.state.error.message) {
          const parsedError = JSON.parse(this.state.error.message);
          if (parsedError.error && parsedError.error.includes("Missing or insufficient permissions")) {
            errorMessage = "You don't have permission to perform this action. Please check your account settings or contact support.";
          }
        }
      } catch (e) {
        // Not a JSON error message
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
          <div className="max-w-md w-full bg-white rounded-3xl p-8 shadow-xl text-center space-y-6">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto">
              <XCircle size={32} />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Application Error</h2>
            <p className="text-gray-600">{errorMessage}</p>
            <button 
              onClick={() => window.location.reload()}
              className="w-full bg-[#141414] text-white py-4 rounded-2xl font-bold hover:bg-[#141414]/90 transition-all"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

function formatTimestamp(timestamp: any, format: 'time' | 'date' | 'full' = 'full') {
  if (!timestamp) return '...';
  
  let date: Date;
  if (timestamp instanceof Timestamp) {
    date = timestamp.toDate();
  } else if (timestamp && typeof timestamp.toDate === 'function') {
    date = timestamp.toDate();
  } else if (timestamp instanceof Date) {
    date = timestamp;
  } else if (typeof timestamp === 'number') {
    date = new Date(timestamp);
  } else if (typeof timestamp === 'string') {
    date = new Date(timestamp);
  } else {
    return 'Invalid Date';
  }

  if (isNaN(date.getTime())) return 'Invalid Date';

  if (format === 'time') return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (format === 'date') return date.toLocaleDateString();
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

export default function App() {
  const [view, setView] = useState<View>('user');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [adminStats, setAdminStats] = useState<any>(null);
  const [checkoutStep, setCheckoutStep] = useState<'cart' | 'table' | 'payment' | 'success'>('cart');
  const [customerInfo, setCustomerInfo] = useState({ name: '', table_number: '' });
  const [lastOrderId, setLastOrderId] = useState<string | null>(null);
  const [paymentTimer, setPaymentTimer] = useState<number>(0);
  const [restaurantSubView, setRestaurantSubView] = useState<'orders' | 'menu' | 'categories'>('orders');
  const [adminSubView, setAdminSubView] = useState<'overview' | 'transactions'>('overview');
  
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const [isCareerAuthenticated, setIsCareerAuthenticated] = useState(false);
  const [showCareerLogin, setShowCareerLogin] = useState(false);
  const [careerUsername, setCareerUsername] = useState('');
  const [careerPassword, setCareerPassword] = useState('');
  const [careerLoginError, setCareerLoginError] = useState('');

  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminLoginError, setAdminLoginError] = useState('');
  const [profile, setProfile] = useState<UserProfile>({ name: '', mobile: '', email: '', photo_url: '' });
  const [isProfileSaving, setIsProfileSaving] = useState(false);
  const [isProfileSaved, setIsProfileSaved] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'upi' | 'cash' | null>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const [reviews, setReviews] = useState<Review[]>([]);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [reviewingItem, setReviewingItem] = useState<MenuItem | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  const [isMenuModalOpen, setIsMenuModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [menuFormData, setMenuFormData] = useState({
    name: '',
    description: '',
    price: '',
    category_id: '',
    image_url: ''
  });

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [authError, setAuthError] = useState('');

  // Auth Listener
  useEffect(() => {
    // Test connection to Firestore
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
        console.log("Firebase connection verified.");
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration. The client is offline.");
        }
        // Skip logging for other errors, as this is simply a connection test.
      }
    };
    testConnection();

    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) {
        if (u.emailVerified || u.providerData.some(p => p.providerId === 'google.com')) {
          fetchProfile(u);
        } else {
          setProfile(prev => ({ ...prev, email: u.email || '', photo_url: u.photoURL || '', role: 'user' }));
          setIsAuthReady(true);
        }
      } else {
        setProfile({ name: '', mobile: '', email: '', photo_url: '', role: 'user' });
        setIsProfileSaved(false);
        setIsAuthReady(true);
      }
    });
    return () => unsubscribe();
  }, []);

  const fetchProfile = async (u: FirebaseUser) => {
    const uid = u.uid;
    try {
      const docRef = doc(db, 'profiles', uid);
      const docSnap = await getDoc(docRef);
      
      const bootstrapAdmins = ["8574ashu@gmail.com"];
      const isBootstrapAdmin = u.email && bootstrapAdmins.includes(u.email);

      if (docSnap.exists()) {
        const data = docSnap.data() as UserProfile;
        
        // Ensure bootstrap admins always have the admin role
        if (isBootstrapAdmin && data.role !== 'admin') {
          data.role = 'admin';
          await setDoc(docRef, { role: 'admin' }, { merge: true });
        }

        // Auto-populate photo_url if missing but available from auth
        if (!data.photo_url && u.photoURL) {
          data.photo_url = u.photoURL;
          await setDoc(docRef, { photo_url: u.photoURL }, { merge: true });
        }

        setProfile(data);
        if (data.name || data.mobile || data.email) {
          setIsProfileSaved(true);
        }
        
        // Auto-auth for bootstrap admins to make it seamless
        if (isBootstrapAdmin) {
          setIsCareerAuthenticated(true);
          setIsAdminAuthenticated(true);
        }
      } else {
        // Create initial profile for new user
        const initialProfile: UserProfile = {
          name: u.displayName || '',
          email: u.email || '',
          mobile: '',
          photo_url: u.photoURL || '',
          role: isBootstrapAdmin ? 'admin' : 'user'
        };
        await setDoc(docRef, initialProfile);
        setProfile(initialProfile);

        if (isBootstrapAdmin) {
          setIsCareerAuthenticated(true);
          setIsAdminAuthenticated(true);
        }
      }
      setIsAuthReady(true);
    } catch (e) {
      handleFirestoreError(e, OperationType.GET, `profiles/${uid}`);
      setIsAuthReady(true);
    }
  };

  useEffect(() => {
    if (!isAuthReady) return;
    const q = query(collection(db, 'reviews'), orderBy('created_at', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const reviewsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Review));
      setReviews(reviewsData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'reviews');
    });
    return () => unsubscribe();
  }, [isAuthReady]);

  const submitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !reviewingItem) return;
    setIsSubmittingReview(true);
    try {
      await addDoc(collection(db, 'reviews'), {
        menu_item_id: reviewingItem.id,
        user_id: user.uid,
        user_name: profile.name || user.displayName || 'Anonymous',
        user_photo: profile.photo_url || user.photoURL || '',
        rating: reviewRating,
        comment: reviewComment,
        created_at: serverTimestamp()
      });
      setIsReviewModalOpen(false);
      setReviewingItem(null);
      setReviewRating(5);
      setReviewComment('');
      alert("Review submitted successfully!");
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, 'reviews');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const login = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (e) {
      console.error("Login failed", e);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setAuthError("Please enter your email address first.");
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      setAuthError("Password reset email sent! Please check your inbox.");
    } catch (e: any) {
      console.error("Password reset failed", e);
      setAuthError(e.message || "Failed to send password reset email.");
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');

    try {
      if (isRegistering) {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await sendEmailVerification(userCredential.user);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      setEmail('');
      setPassword('');
    } catch (e: any) {
      console.error("Email auth failed", e);
      let message = "Authentication failed. Please try again.";
      
      // Handle common Firebase Auth error codes
      switch (e.code) {
        case 'auth/invalid-credential':
          message = isRegistering 
            ? "This email might already be in use with another method (like Google). Try signing in with Google." 
            : "Invalid email or password. Please check your credentials or register if you don't have an account.";
          break;
        case 'auth/email-already-in-use':
          message = "This email is already registered. Please sign in instead.";
          // Automatically suggest switching to sign in
          break;
        case 'auth/weak-password':
          message = "Password should be at least 6 characters.";
          break;
        case 'auth/invalid-email':
          message = "Please enter a valid email address.";
          break;
        case 'auth/user-not-found':
          message = "No account found with this email. Please register first.";
          break;
        case 'auth/wrong-password':
          message = "Incorrect password. Please try again.";
          break;
        case 'auth/operation-not-allowed':
          message = "Email/password accounts are not enabled. Please contact support.";
          break;
        case 'auth/too-many-requests':
          message = "Too many failed attempts. Please try again later.";
          break;
        default:
          message = e.message || message;
      }
      
      setAuthError(message);
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      setView('user');
      setIsCareerAuthenticated(false);
      setIsAdminAuthenticated(false);
    } catch (e) {
      console.error("Logout failed", e);
    }
  };

  const handleCareerLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (careerUsername === 'chef' && careerPassword === 'kitchen123') {
      setIsCareerAuthenticated(true);
      setShowCareerLogin(false);
      setView('restaurant');
    } else {
      setCareerLoginError('Invalid credentials');
    }
  };

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminUsername === 'admin' && adminPassword === 'admin123') {
      setIsAdminAuthenticated(true);
      setShowAdminLogin(false);
      setView('admin');
    } else {
      setAdminLoginError('Invalid credentials');
    }
  };

  const handlePayment = async () => {
    setIsProcessingPayment(true);
    setPaymentError(null);
    
    // Simulate payment processing delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Randomly simulate success or failure (mostly success)
    const isSuccess = Math.random() > 0.1;
    
    if (isSuccess) {
      if (lastOrderId && paymentMethod) {
        try {
          await updateDoc(doc(db, 'orders', lastOrderId), { 
            payment_method: paymentMethod 
          });
        } catch (e) {
          console.error("Error updating payment method:", e);
        }
      }
      setCheckoutStep('success');
      setCart([]); // Clear cart only after successful payment
    } else {
      setPaymentError('Payment failed. Please try again or choose another method.');
    }
    setIsProcessingPayment(false);
  };

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsProfileSaving(true);
    try {
      const docRef = doc(db, 'profiles', user.uid);
      await setDoc(docRef, profile, { merge: true });
      setIsProfileSaved(true);
      alert("Profile saved successfully!");
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `profiles/${user.uid}`);
    } finally {
      setIsProfileSaving(false);
    }
  };

  // Real-time Listeners
  useEffect(() => {
    if (!isAuthReady) return;

    const menuUnsubscribe = onSnapshot(collection(db, 'menu_items'), (snapshot) => {
      const menuData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as unknown as MenuItem));
      setMenu(menuData);
    }, (e) => handleFirestoreError(e, OperationType.LIST, 'menu_items'));

    const catUnsubscribe = onSnapshot(collection(db, 'categories'), (snapshot) => {
      const catData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as unknown as Category));
      setCategories(catData);
    }, (e) => handleFirestoreError(e, OperationType.LIST, 'categories'));

    return () => {
      menuUnsubscribe();
      catUnsubscribe();
    };
  }, [isAuthReady]);

  useEffect(() => {
    if (!isAuthReady || !user || !user.emailVerified) return;

    let ordersQuery;
    if (isAdminAuthenticated || isCareerAuthenticated) {
      ordersQuery = query(collection(db, 'orders'), orderBy('created_at', 'desc'));
    } else {
      // Regular users only see their own orders
      // Note: This requires a composite index if we filter by uid AND order by created_at
      ordersQuery = query(
        collection(db, 'orders'), 
        where('uid', '==', user.uid),
        orderBy('created_at', 'desc')
      );
    }

    const ordersUnsubscribe = onSnapshot(ordersQuery, async (snapshot) => {
      const ordersData = await Promise.all(snapshot.docs.map(async (orderDoc) => {
        const order = { id: orderDoc.id, ...orderDoc.data() } as Order;
        
        // Fetch subcollection items
        const itemsSnap = await getDocs(collection(db, 'orders', orderDoc.id, 'items'));
        const items = itemsSnap.docs.map(itemDoc => ({ id: itemDoc.id, ...itemDoc.data() } as any));
        
        return { ...order, items };
      }));

      // Filter for non-admins
      const filteredOrders = (isAdminAuthenticated || isCareerAuthenticated) 
        ? ordersData 
        : ordersData.filter(o => o.uid === user.uid);

      setOrders(filteredOrders);
    }, (e) => handleFirestoreError(e, OperationType.LIST, 'orders'));

    return () => ordersUnsubscribe();
  }, [isAuthReady, user, isAdminAuthenticated, isCareerAuthenticated]);

  useEffect(() => {
    if (isAdminAuthenticated) {
      const totalRevenue = orders.reduce((sum, o) => sum + (o.status === 'delivered' ? o.total : 0), 0);
      setAdminStats({
        totalOrders: orders.length,
        totalRevenue,
        recentOrders: orders.slice(0, 5)
      });
    }
  }, [orders, isAdminAuthenticated]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setMenuFormData(prev => ({ ...prev, image_url: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleProfileImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfile(prev => ({ ...prev, photo_url: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleMenuSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const data = {
        name: menuFormData.name,
        description: menuFormData.description,
        price: parseFloat(menuFormData.price),
        category_id: menuFormData.category_id,
        image_url: menuFormData.image_url,
        available: true
      };

      if (editingItem) {
        await updateDoc(doc(db, 'menu_items', editingItem.id), data);
      } else {
        await addDoc(collection(db, 'menu_items'), data);
      }
      
      setIsMenuModalOpen(false);
      setEditingItem(null);
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, 'menu_items');
    }
  };

  const deleteMenuItem = async (id: string) => {
    if (!confirm('Are you sure you want to delete this item?')) return;
    try {
      await deleteDoc(doc(db, 'menu_items', id));
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, `menu_items/${id}`);
    }
  };

  const openEditModal = (item: MenuItem) => {
    setEditingItem(item);
    setMenuFormData({
      name: item.name,
      description: item.description,
      price: item.price.toString(),
      category_id: item.category_id,
      image_url: item.image_url
    });
    setIsMenuModalOpen(true);
  };

  const addCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    try {
      await addDoc(collection(db, 'categories'), {
        name: newCategoryName.trim()
      });
      setNewCategoryName('');
      setIsCategoryModalOpen(false);
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, 'categories');
    }
  };

  const deleteCategory = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'categories', id));
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, `categories/${id}`);
    }
  };

  const openAddModal = () => {
    setEditingItem(null);
    setMenuFormData({
      name: '',
      description: '',
      price: '',
      category_id: categories[0]?.id || '',
      image_url: ''
    });
    setIsMenuModalOpen(true);
  };

  const addToCart = (item: MenuItem) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) {
        return prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { ...item, quantity: 1 }];
    });
    setIsCartOpen(true);
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(i => i.id !== id));
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => prev.map(i => {
      if (i.id === id) {
        const newQty = Math.max(1, i.quantity + delta);
        return { ...i, quantity: newQty };
      }
      return i;
    }));
  };

  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const handleCheckout = async () => {
    if (!customerInfo.name || !customerInfo.table_number || !user) return;
    
    setIsPlacingOrder(true);
    try {
      const orderData = {
        customer_name: customerInfo.name,
        table_number: customerInfo.table_number,
        total: cartTotal,
        status: 'pending',
        created_at: serverTimestamp(),
        uid: user.uid
      };

      const orderRef = await addDoc(collection(db, 'orders'), orderData);
      
      // Add items to subcollection
      for (const item of cart) {
        await addDoc(collection(db, 'orders', orderRef.id, 'items'), {
          menu_item_id: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          image_url: item.image_url
        });
      }

      setLastOrderId(orderRef.id);
      setPaymentTimer(60); // 1 minute
      setPaymentMethod(null);
      setCheckoutStep('payment');
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, 'orders');
    } finally {
      setIsPlacingOrder(false);
    }
  };

  const updateOrderStatus = async (id: string, status: string) => {
    try {
      await updateDoc(doc(db, 'orders', id), { status });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `orders/${id}`);
    }
  };

  const filteredMenu = activeCategory 
    ? menu.filter(item => item.category_id === activeCategory)
    : menu;

  if (!isAuthReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F5F0]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[#141414] border-t-transparent rounded-full animate-spin"></div>
          <p className="font-medium text-gray-500">Loading your experience...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#F5F5F0] flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-white rounded-[40px] p-10 shadow-2xl border border-black/5 text-center space-y-8"
        >
          <div className="flex flex-col items-center gap-4">
            <div className="w-20 h-20 bg-[#141414] rounded-3xl flex items-center justify-center shadow-xl shadow-black/10">
              <Utensils size={40} className="text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-black tracking-tight text-[#141414]">QuickBite</h1>
              <p className="text-gray-400 font-medium mt-1">Digital Dining Experience</p>
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-[#141414]">
              {isRegistering ? 'Create Account' : 'Welcome Back'}
            </h2>
            <p className="text-gray-500 leading-relaxed">
              {isRegistering 
                ? 'Register with your email to start your dining journey.' 
                : 'Sign in to access your menu and track your orders.'}
            </p>
          </div>

          <form onSubmit={handleEmailAuth} className="space-y-4 text-left">
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-gray-400 ml-1">Email Address</label>
              <input 
                type="email" 
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-gray-50 border border-black/5 rounded-2xl px-5 py-4 focus:outline-none focus:ring-2 focus:ring-[#141414]/10 transition-all"
                placeholder="name@example.com"
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold uppercase tracking-wider text-gray-400 ml-1">Password</label>
                {!isRegistering && (
                  <button 
                    type="button"
                    onClick={handleForgotPassword}
                    className="text-[10px] font-bold uppercase tracking-wider text-orange-500 hover:underline"
                  >
                    Forgot Password?
                  </button>
                )}
              </div>
              <input 
                type="password" 
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-gray-50 border border-black/5 rounded-2xl px-5 py-4 focus:outline-none focus:ring-2 focus:ring-[#141414]/10 transition-all"
                placeholder="••••••••"
              />
            </div>

            {authError && (
              <div className="text-red-500 text-sm font-medium bg-red-50 p-4 rounded-xl border border-red-100 space-y-2">
                <p>{authError}</p>
                {(authError.includes('already registered') || authError.includes('already in use')) && isRegistering && (
                  <button 
                    type="button"
                    onClick={() => {
                      setIsRegistering(false);
                      setAuthError('');
                    }}
                    className="text-xs font-bold uppercase tracking-wider text-red-600 hover:underline"
                  >
                    Switch to Sign In
                  </button>
                )}
                {authError.includes('haven\'t registered yet') && !isRegistering && (
                  <button 
                    type="button"
                    onClick={() => {
                      setIsRegistering(true);
                      setAuthError('');
                    }}
                    className="text-xs font-bold uppercase tracking-wider text-red-600 hover:underline"
                  >
                    Switch to Register
                  </button>
                )}
              </div>
            )}

            <button 
              type="submit"
              className="w-full bg-[#141414] text-white py-5 rounded-2xl font-bold hover:bg-[#141414]/90 transition-all shadow-lg shadow-black/10 active:scale-95"
            >
              {isRegistering ? 'Register Now' : 'Sign In'}
            </button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-100"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-4 text-gray-400 font-bold tracking-widest">Or continue with</span>
            </div>
          </div>

          <button 
            onClick={login}
            className="w-full bg-white border border-black/5 text-[#141414] py-5 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-gray-50 transition-all shadow-sm group active:scale-95"
          >
            <div className="bg-white p-1 rounded-md border border-black/5">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M23.5 12.2c0-.8-.1-1.6-.2-2.3H12v4.4h6.5c-.3 1.5-1.1 2.7-2.4 3.6v3h3.8c2.3-2.1 3.6-5.2 3.6-8.7z" fill="#4285F4"/>
                <path d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.8-3c-1.1.7-2.5 1.1-4.1 1.1-3.1 0-5.8-2.1-6.8-5H1.3v3.1C3.3 21.3 7.4 24 12 24z" fill="#34A853"/>
                <path d="M5.2 14.2c-.2-.7-.4-1.4-.4-2.2s.2-1.5.4-2.2V6.7H1.3c-.8 1.6-1.3 3.4-1.3 5.3s.5 3.7 1.3 5.3l3.9-3.1z" fill="#FBBC05"/>
                <path d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4C17.9 1.2 15.2 0 12 0 7.4 0 3.3 2.7 1.3 6.7l3.9 3.1c1-2.9 3.7-5 6.8-5z" fill="#EA4335"/>
              </svg>
            </div>
            Google Account
          </button>

          <div className="pt-4">
            <button 
              onClick={() => {
                setIsRegistering(!isRegistering);
                setAuthError('');
              }}
              className="text-sm font-bold text-[#141414] hover:underline"
            >
              {isRegistering ? 'Already have an account? Sign In' : "Don't have an account? Register"}
            </button>
          </div>

          <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">
            Secure Authentication by Firebase
          </p>
        </motion.div>
      </div>
    );
  }

  if (user && !user.emailVerified) {
    return (
      <div className="min-h-screen bg-[#F5F5F0] flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-white rounded-[40px] p-10 shadow-2xl border border-black/5 text-center space-y-8"
        >
          <div className="flex flex-col items-center gap-4">
            <div className="w-20 h-20 bg-orange-500 rounded-3xl flex items-center justify-center shadow-xl shadow-orange-500/20">
              <CheckCircle2 size={40} className="text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-black tracking-tight text-[#141414]">Verify Email</h1>
              <p className="text-gray-400 font-medium mt-1">Check your inbox</p>
            </div>
          </div>

          <div className="space-y-4">
            <p className="text-gray-500 leading-relaxed">
              We've sent a verification email to <span className="font-bold text-[#141414]">{user.email}</span>. 
              Please verify your email to access the app.
            </p>
          </div>

          <div className="space-y-4">
            <button 
              onClick={async () => {
                try {
                  await user.reload();
                  if (auth.currentUser?.emailVerified) {
                    window.location.reload();
                  } else {
                    alert('Email not verified yet. Please check your inbox.');
                  }
                } catch (e) {
                  console.error(e);
                }
              }}
              className="w-full bg-[#141414] text-white py-5 rounded-2xl font-bold hover:bg-[#141414]/90 transition-all shadow-lg shadow-black/10 active:scale-95"
            >
              I've Verified My Email
            </button>
            <button 
              onClick={async () => {
                try {
                  await sendEmailVerification(user);
                  alert('Verification email resent!');
                } catch (e) {
                  console.error(e);
                  alert('Failed to resend. Please try again later.');
                }
              }}
              className="w-full bg-white border border-black/5 text-[#141414] py-4 rounded-2xl font-bold hover:bg-gray-50 transition-all"
            >
              Resend Verification Email
            </button>
            <button 
              onClick={() => signOut(auth)}
              className="w-full text-gray-400 py-2 text-sm font-bold hover:text-red-500 transition-colors"
            >
              Sign Out
            </button>
          </div>
          
          <p className="text-xs text-gray-400 font-medium">
            Already verified? Click the button above to continue.
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-[#F5F5F0] text-[#141414] font-sans">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white border-b border-[#141414]/10 px-4 py-3">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <button 
            onClick={() => {
              setView('user');
              setIsMobileMenuOpen(false);
            }}
            className="flex items-center gap-2 group"
          >
            <div className="p-1.5 rounded-lg bg-[#141414] text-white group-hover:bg-orange-500 transition-colors flex items-center justify-center">
              <Utensils size={16} />
            </div>
            <span className="text-xl font-bold tracking-tight text-[#141414]">
              QuickBite
            </span>
          </button>

          <div className="flex items-center gap-3 md:gap-6">
            <div className="hidden md:flex items-center gap-2 md:gap-4 bg-gray-100 p-1 rounded-full">
                <button 
                  onClick={() => setView('user')}
                  className={cn(
                    "px-3 md:px-4 py-1.5 rounded-full text-xs md:sm font-medium transition-all",
                    view === 'user' ? "bg-white shadow-sm text-[#141414]" : "text-gray-500 hover:text-[#141414]"
                  )}
                >
                  Order
                </button>
                
                {/* Career button visible only for admins or if already authenticated */}
                {(profile.role === 'admin' || isCareerAuthenticated) && (
                  !isCareerAuthenticated ? (
                    <button 
                      onClick={() => setShowCareerLogin(true)}
                      className={cn(
                        "px-3 md:px-4 py-1.5 rounded-full text-xs md:sm font-medium transition-all",
                        showCareerLogin ? "bg-white shadow-sm text-[#141414]" : "text-gray-500 hover:text-[#141414]"
                      )}
                    >
                      Career
                    </button>
                  ) : (
                    <button 
                      onClick={() => setView('restaurant')}
                      className={cn(
                        "px-3 md:px-4 py-1.5 rounded-full text-xs md:sm font-medium transition-all",
                        view === 'restaurant' ? "bg-white shadow-sm text-[#141414]" : "text-gray-500 hover:text-[#141414]"
                      )}
                    >
                      Kitchen
                    </button>
                  )
                )}

                {/* Admin button visible only for admins or if already authenticated */}
                {(profile.role === 'admin' || isAdminAuthenticated) && (
                  <button 
                    onClick={() => {
                      if (isAdminAuthenticated) {
                        setView('admin');
                      } else {
                        setShowAdminLogin(true);
                      }
                    }}
                    className={cn(
                      "px-3 md:px-4 py-1.5 rounded-full text-xs md:sm font-medium transition-all",
                      view === 'admin' ? "bg-white shadow-sm text-[#141414]" : "text-gray-500 hover:text-[#141414]"
                    )}
                  >
                    Admin
                  </button>
                )}
            </div>

            <div className="flex items-center gap-2 md:gap-4">
              {view === 'user' && (
                <button 
                  onClick={() => setIsCartOpen(true)}
                  className="relative p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <ShoppingBag size={22} className="md:w-6 md:h-6" />
                  {cart.length > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full border-2 border-white">
                      {cart.reduce((s, i) => s + i.quantity, 0)}
                    </span>
                  )}
                </button>
              )}

              <button 
                onClick={() => setView('profile')}
                className={cn(
                  "p-0.5 rounded-full transition-all border-2",
                  view === 'profile' ? "border-orange-500" : "border-transparent hover:border-gray-200"
                )}
              >
                <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-gray-100 overflow-hidden flex items-center justify-center">
                  {profile.photo_url ? (
                    <img src={profile.photo_url} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="text-[10px] md:text-xs font-bold text-gray-400 uppercase">
                      {profile.email ? profile.email[0] : <User size={14} />}
                    </div>
                  )}
                </div>
              </button>

              <button 
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="md:hidden p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                {isMobileMenuOpen ? <X size={22} /> : <MenuIcon size={22} />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="md:hidden overflow-hidden bg-white border-t border-gray-100 mt-3"
            >
              <div className="py-4 flex flex-col gap-2">
                <button 
                  onClick={() => {
                    setView('user');
                    setIsMobileMenuOpen(false);
                  }}
                  className={cn(
                    "px-4 py-3 rounded-xl text-sm font-bold flex items-center gap-3 transition-all",
                    view === 'user' ? "bg-orange-50 text-orange-600" : "text-gray-600 hover:bg-gray-50"
                  )}
                >
                  <ShoppingBag size={18} /> Order Online
                </button>

                {(profile.role === 'admin' || isCareerAuthenticated) && (
                  <button 
                    onClick={() => {
                      if (isCareerAuthenticated) {
                        setView('restaurant');
                      } else {
                        setShowCareerLogin(true);
                      }
                      setIsMobileMenuOpen(false);
                    }}
                    className={cn(
                      "px-4 py-3 rounded-xl text-sm font-bold flex items-center gap-3 transition-all",
                      view === 'restaurant' ? "bg-orange-50 text-orange-600" : "text-gray-600 hover:bg-gray-50"
                    )}
                  >
                    <Utensils size={18} /> Kitchen Dashboard
                  </button>
                )}

                {(profile.role === 'admin' || isAdminAuthenticated) && (
                  <button 
                    onClick={() => {
                      if (isAdminAuthenticated) {
                        setView('admin');
                      } else {
                        setShowAdminLogin(true);
                      }
                      setIsMobileMenuOpen(false);
                    }}
                    className={cn(
                      "px-4 py-3 rounded-xl text-sm font-bold flex items-center gap-3 transition-all",
                      view === 'admin' ? "bg-orange-50 text-orange-600" : "text-gray-600 hover:bg-gray-50"
                    )}
                  >
                    <TrendingUp size={18} /> Admin Panel
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* Career Login Modal */}
      <AnimatePresence>
        {showCareerLogin && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-md rounded-3xl p-8 shadow-2xl"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">Career Access</h2>
                <button onClick={() => setShowCareerLogin(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                  <X size={24} />
                </button>
              </div>
              
              <form onSubmit={handleCareerLogin} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-400">Username</label>
                  <input 
                    type="text" 
                    required
                    value={careerUsername}
                    onChange={e => setCareerUsername(e.target.value)}
                    className="w-full p-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-[#141414]"
                    placeholder="Enter username"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-400">Password</label>
                  <input 
                    type="password" 
                    required
                    value={careerPassword}
                    onChange={e => setCareerPassword(e.target.value)}
                    className="w-full p-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-[#141414]"
                    placeholder="Enter password"
                  />
                </div>
                
                {careerLoginError && (
                  <p className="text-red-500 text-sm font-medium">{careerLoginError}</p>
                )}
                
                <button 
                  type="submit"
                  className="w-full bg-[#141414] text-white py-4 rounded-2xl font-bold hover:bg-[#141414]/90 transition-all"
                >
                  Login to Career Section
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Admin Login Modal */}
      <AnimatePresence>
        {showAdminLogin && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-md rounded-3xl p-8 shadow-2xl"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">Admin Access</h2>
                <button onClick={() => setShowAdminLogin(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                  <X size={24} />
                </button>
              </div>
              
              <form onSubmit={handleAdminLogin} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-400">Username</label>
                  <input 
                    type="text" 
                    required
                    value={adminUsername}
                    onChange={e => setAdminUsername(e.target.value)}
                    className="w-full p-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-[#141414]"
                    placeholder="Enter admin username"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-400">Password</label>
                  <input 
                    type="password" 
                    required
                    value={adminPassword}
                    onChange={e => setAdminPassword(e.target.value)}
                    className="w-full p-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-[#141414]"
                    placeholder="Enter admin password"
                  />
                </div>
                
                {adminLoginError && (
                  <p className="text-red-500 text-sm font-medium">{adminLoginError}</p>
                )}
                
                <button 
                  type="submit"
                  className="w-full bg-[#141414] text-white py-4 rounded-2xl font-bold hover:bg-[#141414]/90 transition-all"
                >
                  Login to Admin Section
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <main className="max-w-7xl mx-auto p-4 md:p-8">
        {view === 'user' && (
          <div className="space-y-8">
            {/* Hero */}
            <section className="relative min-h-[250px] md:h-[300px] py-8 md:py-0 rounded-3xl overflow-hidden bg-[#141414] text-white flex items-center px-6 md:px-16">
              <div className="relative z-10 max-w-lg space-y-4">
                <h1 className="text-3xl md:text-6xl font-bold leading-tight">
                  Delicious food, <br />
                  <span className="text-orange-500">delivered fast.</span>
                </h1>
                <p className="text-gray-400 text-sm md:text-lg">
                  Order from your favorite restaurants and track your meal in real-time.
                </p>
              </div>
              <div className="absolute right-0 top-0 h-full w-1/2 opacity-50 hidden md:block">
                <img 
                  src="https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&q=80&w=1000" 
                  alt="Hero" 
                  className="h-full w-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
            </section>

            {/* Categories */}
            <section className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
              <button 
                onClick={() => setActiveCategory(null)}
                className={cn(
                  "px-6 py-3 rounded-2xl whitespace-nowrap font-medium transition-all border",
                  activeCategory === null 
                    ? "bg-[#141414] text-white border-[#141414]" 
                    : "bg-white text-gray-600 border-gray-200 hover:border-[#141414]"
                )}
              >
                All Items
              </button>
              {categories.map(cat => (
                <button 
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={cn(
                    "px-6 py-3 rounded-2xl whitespace-nowrap font-medium transition-all border",
                    activeCategory === cat.id 
                      ? "bg-[#141414] text-white border-[#141414]" 
                      : "bg-white text-gray-600 border-gray-200 hover:border-[#141414]"
                  )}
                >
                  {cat.name}
                </button>
              ))}
            </section>

            {/* Menu Grid */}
            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {filteredMenu.map(item => (
                <motion.div 
                  layout
                  key={item.id}
                  className="bg-white rounded-3xl overflow-hidden border border-gray-100 hover:shadow-xl transition-all group"
                >
                  <div className="h-48 overflow-hidden relative">
                    <img 
                      src={item.image_url} 
                      alt={item.name}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute top-3 right-3 bg-white/90 backdrop-blur px-3 py-1 rounded-full text-sm font-bold shadow-sm">
                      ₹{item.price.toFixed(2)}
                    </div>
                  </div>
                    <div className="p-5 space-y-3">
                      <div>
                        <div className="flex justify-between items-start">
                          <h3 className="font-bold text-lg">{item.name}</h3>
                          {/* Rating Display */}
                          {(() => {
                            const itemReviews = reviews.filter(r => r.menu_item_id === item.id);
                            if (itemReviews.length === 0) return null;
                            const avgRating = itemReviews.reduce((sum, r) => sum + r.rating, 0) / itemReviews.length;
                            return (
                              <div className="flex items-center gap-1 bg-orange-50 px-2 py-0.5 rounded-lg">
                                <Star size={12} className="fill-orange-500 text-orange-500" />
                                <span className="text-[10px] font-bold text-orange-600">{avgRating.toFixed(1)}</span>
                              </div>
                            );
                          })()}
                        </div>
                        <p className="text-gray-500 text-sm line-clamp-2">{item.description}</p>
                        {/* Review Count */}
                        {(() => {
                          const count = reviews.filter(r => r.menu_item_id === item.id).length;
                          if (count === 0) return null;
                          return <p className="text-[10px] text-gray-400 font-medium mt-1">{count} reviews</p>;
                        })()}
                      </div>
                      <button 
                      onClick={() => addToCart(item)}
                      className="w-full bg-[#141414] text-white py-3 rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-[#141414]/90 transition-colors"
                    >
                      <Plus size={18} />
                      Add to Cart
                    </button>
                  </div>
                </motion.div>
              ))}
            </section>
          </div>
        )}

        {view === 'restaurant' && (
          <div className="space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <h2 className="text-3xl font-bold">Restaurant Dashboard</h2>
              <div className="flex bg-white p-1 rounded-xl border border-gray-100 shadow-sm overflow-x-auto scrollbar-hide max-w-full">
                <button 
                  onClick={() => setRestaurantSubView('orders')}
                  className={cn(
                    "px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap",
                    restaurantSubView === 'orders' ? "bg-[#141414] text-white" : "text-gray-500 hover:text-[#141414]"
                  )}
                >
                  Active Orders
                </button>
                <button 
                  onClick={() => setRestaurantSubView('menu')}
                  className={cn(
                    "px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap",
                    restaurantSubView === 'menu' ? "bg-[#141414] text-white" : "text-gray-500 hover:text-[#141414]"
                  )}
                >
                  Menu Management
                </button>
                <button 
                  onClick={() => setRestaurantSubView('categories')}
                  className={cn(
                    "px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap",
                    restaurantSubView === 'categories' ? "bg-[#141414] text-white" : "text-gray-500 hover:text-[#141414]"
                  )}
                >
                  Categories
                </button>
              </div>
            </div>

            {restaurantSubView === 'orders' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {orders.map(order => (
                  <div key={order.id} className="bg-white rounded-3xl p-6 border border-gray-100 space-y-4 shadow-sm">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Order #{order.id}</span>
                        <h3 className="font-bold text-lg">{order.customer_name}</h3>
                      </div>
                      <div className={cn(
                        "px-3 py-1 rounded-full text-xs font-bold uppercase",
                        order.status === 'pending' ? "bg-orange-100 text-orange-600" :
                        order.status === 'preparing' ? "bg-blue-100 text-blue-600" :
                        "bg-green-100 text-green-600"
                      )}>
                        {order.status}
                      </div>
                    </div>

                    <div className="space-y-2 border-y border-gray-50 py-4">
                      <p className="text-sm text-gray-500 flex items-center gap-2">
                        <Utensils size={14} /> Table No: {order.table_number}
                      </p>
                      <p className="text-sm text-gray-500 flex items-center gap-2">
                        <Clock size={14} /> {formatTimestamp(order.created_at, 'time')}
                      </p>
                      {order.payment_method && (
                        <p className="text-sm text-gray-500 flex items-center gap-2">
                          <CreditCard size={14} /> Payment: <span className="font-bold uppercase text-[#141414]">{order.payment_method}</span>
                        </p>
                      )}
                    </div>

                    <div className="space-y-3">
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Items Ordered</p>
                      <div className="space-y-2">
                        {order.items?.map((item: any) => (
                          <div key={item.id} className="flex items-center justify-between bg-gray-50 p-2 rounded-xl border border-gray-100">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-lg overflow-hidden border border-gray-200 bg-white">
                                <img 
                                  src={item.image_url} 
                                  alt={item.name} 
                                  className="w-full h-full object-cover"
                                  referrerPolicy="no-referrer"
                                />
                              </div>
                              <div>
                                <p className="text-sm font-bold">{item.name}</p>
                                <p className="text-[10px] text-gray-400 font-medium">Qty: {item.quantity}</p>
                              </div>
                            </div>
                            <div className="text-xs font-bold text-gray-400">
                              ₹{(item.price * item.quantity).toFixed(2)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      {order.status === 'pending' && (
                        <>
                          <button 
                            onClick={() => updateOrderStatus(order.id, 'accepted')}
                            className="flex-1 bg-green-500 text-white py-2 rounded-xl font-medium hover:bg-green-600 transition-colors"
                          >
                            Accept
                          </button>
                          <button 
                            onClick={() => updateOrderStatus(order.id, 'rejected')}
                            className="flex-1 bg-red-500 text-white py-2 rounded-xl font-medium hover:bg-red-600 transition-colors"
                          >
                            Reject
                          </button>
                        </>
                      )}
                      {order.status === 'accepted' && (
                        <button 
                          onClick={() => updateOrderStatus(order.id, 'preparing')}
                          className="w-full bg-blue-500 text-white py-2 rounded-xl font-medium hover:bg-blue-600 transition-colors"
                        >
                          Start Preparing
                        </button>
                      )}
                      {order.status === 'preparing' && (
                        <button 
                          onClick={() => updateOrderStatus(order.id, 'ready')}
                          className="w-full bg-orange-500 text-white py-2 rounded-xl font-medium hover:bg-orange-600 transition-colors"
                        >
                          Mark as Ready
                        </button>
                      )}
                      {order.status === 'ready' && (
                        <button 
                          onClick={() => updateOrderStatus(order.id, 'delivered')}
                          className="w-full bg-green-500 text-white py-2 rounded-xl font-medium hover:bg-green-600 transition-colors"
                        >
                          Complete Order
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : restaurantSubView === 'menu' ? (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-xl font-bold">Menu Items</h3>
                  <button 
                    onClick={openAddModal}
                    className="bg-[#141414] text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-[#141414]/90 transition-all"
                  >
                    <Plus size={20} /> Add New Item
                  </button>
                </div>

                <div className="bg-white rounded-3xl border border-gray-100 overflow-x-auto shadow-sm">
                  <table className="w-full text-left min-w-[600px]">
                    <thead>
                      <tr className="bg-gray-50 text-xs font-bold uppercase tracking-wider text-gray-400">
                        <th className="px-6 py-4">Item</th>
                        <th className="px-6 py-4">Category</th>
                        <th className="px-6 py-4">Price</th>
                        <th className="px-6 py-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {menu.map(item => (
                        <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <img src={item.image_url} className="w-10 h-10 rounded-lg object-cover" referrerPolicy="no-referrer" />
                              <span className="font-bold">{item.name}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500">
                            {categories.find(c => c.id === item.category_id)?.name}
                          </td>
                          <td className="px-6 py-4 font-bold">₹{item.price.toFixed(2)}</td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex justify-end gap-2">
                              <button 
                                onClick={() => openEditModal(item)}
                                className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                              >
                                <Edit2 size={18} />
                              </button>
                              <button 
                                onClick={() => deleteMenuItem(item.id)}
                                className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                              >
                                <Trash2 size={18} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-xl font-bold">Categories</h3>
                  <button 
                    onClick={() => setIsCategoryModalOpen(true)}
                    className="bg-[#141414] text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-[#141414]/90 transition-all"
                  >
                    <Plus size={20} /> Add New Category
                  </button>
                </div>

                <div className="bg-white rounded-3xl border border-gray-100 overflow-x-auto shadow-sm">
                  <table className="w-full text-left min-w-[400px]">
                    <thead>
                      <tr className="bg-gray-50 text-xs font-bold uppercase tracking-wider text-gray-400">
                        <th className="px-6 py-4">Category Name</th>
                        <th className="px-6 py-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {categories.map(cat => (
                        <tr key={cat.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 font-bold">
                            {cat.name}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button 
                              onClick={() => deleteCategory(cat.id)}
                              className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <Trash2 size={18} />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {categories.length === 0 && (
                        <tr>
                          <td colSpan={2} className="px-6 py-8 text-center text-gray-500">
                            No categories found. Add one to start organizing your menu.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Review Modal */}
        <AnimatePresence>
          {isReviewModalOpen && reviewingItem && (
            <>
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsReviewModalOpen(false)}
                className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[110]"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white rounded-[32px] p-8 z-[120] shadow-2xl"
              >
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-2xl font-bold">Rate Item</h3>
                  <button onClick={() => setIsReviewModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full">
                    <X size={24} />
                  </button>
                </div>

                <div className="flex items-center gap-4 mb-8">
                  <img src={reviewingItem.image_url} className="w-16 h-16 rounded-2xl object-cover" referrerPolicy="no-referrer" />
                  <div>
                    <h4 className="font-bold">{reviewingItem.name}</h4>
                    <p className="text-sm text-gray-500">How was your meal?</p>
                  </div>
                </div>

                <form onSubmit={submitReview} className="space-y-6">
                  <div className="space-y-3">
                    <label className="text-xs font-bold uppercase tracking-wider text-gray-400 block text-center">Your Rating</label>
                    <div className="flex justify-center gap-2">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setReviewRating(star)}
                          className="p-1 transition-transform active:scale-90"
                        >
                          <Star 
                            size={32} 
                            className={cn(
                              "transition-colors",
                              star <= reviewRating ? "fill-orange-500 text-orange-500" : "text-gray-200"
                            )} 
                          />
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold uppercase tracking-wider text-gray-400">Your Review (Optional)</label>
                    <textarea 
                      value={reviewComment}
                      onChange={e => setReviewComment(e.target.value)}
                      placeholder="Tell us what you liked or what could be better..."
                      className="w-full p-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-[#141414] h-32 resize-none"
                    />
                  </div>

                  <button 
                    type="submit"
                    disabled={isSubmittingReview}
                    className="w-full bg-[#141414] text-white py-4 rounded-2xl font-bold hover:bg-[#141414]/90 transition-all shadow-lg shadow-black/10 disabled:opacity-50"
                  >
                    {isSubmittingReview ? 'Submitting...' : 'Submit Review'}
                  </button>
                </form>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Category Modal */}
        <AnimatePresence>
          {isCategoryModalOpen && (
            <>
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsCategoryModalOpen(false)}
                className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[80]"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white rounded-[32px] p-8 z-[90] shadow-2xl"
              >
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-2xl font-bold">Add Category</h3>
                  <button onClick={() => setIsCategoryModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full">
                    <X size={24} />
                  </button>
                </div>

                <form onSubmit={addCategory} className="space-y-6">
                  <div className="space-y-1">
                    <label className="text-xs font-bold uppercase tracking-wider text-gray-400">Category Name</label>
                    <input 
                      required
                      type="text" 
                      value={newCategoryName}
                      onChange={e => setNewCategoryName(e.target.value)}
                      placeholder="e.g., Burgers, Pizza"
                      className="w-full p-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-[#141414]"
                    />
                  </div>
                  <button 
                    type="submit"
                    className="w-full bg-[#141414] text-white py-4 rounded-2xl font-bold hover:bg-[#141414]/90 transition-all shadow-lg shadow-black/10"
                  >
                    Create Category
                  </button>
                </form>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Menu Management Modal */}
        <AnimatePresence>
          {isMenuModalOpen && (
            <>
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsMenuModalOpen(false)}
                className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[80]"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="fixed inset-0 m-auto w-full max-w-lg h-fit bg-white z-[90] rounded-3xl shadow-2xl p-8 overflow-y-auto max-h-[90vh]"
              >
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold">{editingItem ? 'Edit Menu Item' : 'Add Menu Item'}</h2>
                  <button onClick={() => setIsMenuModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full">
                    <X size={24} />
                  </button>
                </div>

                <form onSubmit={handleMenuSubmit} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold uppercase tracking-wider text-gray-400">Item Name</label>
                    <input 
                      required
                      type="text" 
                      value={menuFormData.name}
                      onChange={e => setMenuFormData(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full p-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-[#141414]"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold uppercase tracking-wider text-gray-400">Price (INR)</label>
                      <input 
                        required
                        type="number" 
                        step="0.01"
                        value={menuFormData.price}
                        onChange={e => setMenuFormData(prev => ({ ...prev, price: e.target.value }))}
                        className="w-full p-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-[#141414]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold uppercase tracking-wider text-gray-400">Category</label>
                      <select 
                        required
                        value={menuFormData.category_id}
                        onChange={e => setMenuFormData(prev => ({ ...prev, category_id: e.target.value }))}
                        className="w-full p-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-[#141414]"
                      >
                        <option value="" disabled>Select Category</option>
                        {categories.map(cat => (
                          <option key={cat.id} value={cat.id}>{cat.name}</option>
                        ))}
                      </select>
                      {categories.length === 0 && (
                        <p className="text-[10px] text-orange-500 font-bold mt-1">
                          No categories found. Please add a category first.
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold uppercase tracking-wider text-gray-400">Item Image</label>
                    <div className="flex items-center gap-4">
                      <div className="relative w-24 h-24 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 flex items-center justify-center overflow-hidden group">
                        {menuFormData.image_url ? (
                          <>
                            <img src={menuFormData.image_url} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <Camera className="text-white" size={20} />
                            </div>
                          </>
                        ) : (
                          <Camera className="text-gray-300" size={24} />
                        )}
                        <input 
                          type="file" 
                          accept="image/*"
                          onChange={handleImageUpload}
                          className="absolute inset-0 opacity-0 cursor-pointer"
                        />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-gray-500 mb-2">Upload a photo from your gallery</p>
                        <label className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl text-sm font-bold cursor-pointer transition-colors">
                          <Upload size={16} />
                          Choose Photo
                          <input 
                            type="file" 
                            accept="image/*"
                            onChange={handleImageUpload}
                            className="hidden"
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold uppercase tracking-wider text-gray-400">Description</label>
                    <textarea 
                      required
                      value={menuFormData.description}
                      onChange={e => setMenuFormData(prev => ({ ...prev, description: e.target.value }))}
                      className="w-full p-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-[#141414] h-24 resize-none"
                    />
                  </div>
                  <button 
                    type="submit"
                    className="w-full bg-[#141414] text-white py-4 rounded-xl font-bold mt-4 hover:bg-[#141414]/90 transition-all"
                  >
                    {editingItem ? 'Update Item' : 'Add Item'}
                  </button>
                </form>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {view === 'profile' && (
          <div className="max-w-2xl mx-auto space-y-8">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setView('user')}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <ChevronRight className="rotate-180" size={24} />
              </button>
              <h2 className="text-3xl font-bold">My Profile</h2>
            </div>

            <div className="flex justify-end">
              <button 
                onClick={logout}
                className="flex items-center gap-2 bg-red-50 text-red-600 px-6 py-2.5 rounded-2xl font-bold hover:bg-red-100 transition-all border border-red-100 group text-sm"
              >
                <LogOut size={18} className="group-hover:-translate-x-1 transition-transform" />
                Log out
              </button>
            </div>

            <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
              <form onSubmit={saveProfile} className="space-y-6">
                <div className="flex flex-col items-center space-y-4 mb-8">
                  <div className="relative group">
                    <div className="w-32 h-32 rounded-full bg-gray-100 border-4 border-white shadow-lg overflow-hidden flex items-center justify-center">
                      {profile.photo_url ? (
                        <img src={profile.photo_url} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="text-4xl font-bold text-gray-400 uppercase">
                          {profile.email ? profile.email[0] : <User size={48} />}
                        </div>
                      )}
                    </div>
                    <label className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-full cursor-pointer">
                      <Camera className="text-white" size={24} />
                      <input 
                        type="file" 
                        accept="image/*"
                        onChange={handleProfileImageUpload}
                        className="hidden"
                      />
                    </label>
                  </div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Profile Photo</p>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-400">Full Name</label>
                  <input 
                    type="text" 
                    required
                    value={profile.name}
                    onChange={e => setProfile(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full p-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-[#141414]"
                    placeholder="Enter your name"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-400">Mobile Number</label>
                  <input 
                    type="tel" 
                    required
                    value={profile.mobile}
                    onChange={e => setProfile(prev => ({ ...prev, mobile: e.target.value }))}
                    className="w-full p-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-[#141414]"
                    placeholder="Enter mobile number"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-400">Email Address</label>
                  <input 
                    type="email" 
                    required
                    value={profile.email}
                    onChange={e => setProfile(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full p-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-[#141414]"
                    placeholder="Enter email address"
                  />
                </div>

                <button 
                  type="submit"
                  disabled={isProfileSaving}
                  className="w-full bg-[#141414] text-white py-4 rounded-2xl font-bold hover:bg-[#141414]/90 transition-all disabled:opacity-50"
                >
                  {isProfileSaving ? 'Saving...' : (isProfileSaved ? 'Edit Profile' : 'Save Profile')}
                </button>
              </form>
            </div>

            <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold">Order History</h3>
                <span className="px-3 py-1 bg-gray-100 rounded-full text-xs font-bold text-gray-500">
                  {orders.length} Orders
                </span>
              </div>

              {orders.length === 0 ? (
                <div className="text-center py-12 space-y-4">
                  <div className="bg-gray-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto text-gray-300">
                    <ShoppingBag size={32} />
                  </div>
                  <p className="text-gray-400 font-medium">No orders found yet.</p>
                  <button 
                    onClick={() => setView('user')}
                    className="text-orange-500 font-bold hover:underline"
                  >
                    Start Ordering
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {orders.map((order) => (
                    <div key={order.id} className="p-4 bg-gray-50 rounded-2xl space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Order #{order.id.slice(-6)}</p>
                          <p className="text-sm font-medium text-gray-500">{formatTimestamp(order.created_at)}</p>
                        </div>
                        <span className={cn(
                          "px-2 py-1 rounded-full text-[10px] font-bold uppercase",
                          order.status === 'delivered' ? "bg-green-100 text-green-600" : 
                          order.status === 'cancelled' || order.status === 'rejected' ? "bg-red-100 text-red-600" :
                          "bg-orange-100 text-orange-600"
                        )}>
                          {order.status}
                        </span>
                        {order.payment_method && (
                          <span className={cn(
                            "px-2 py-1 rounded-full text-[10px] font-bold uppercase ml-2",
                            order.payment_method === 'upi' ? "bg-blue-100 text-blue-600" : "bg-purple-100 text-purple-600"
                          )}>
                            {order.payment_method}
                          </span>
                        )}
                      </div>
                      
                      <div className="border-t border-dashed border-gray-200 pt-3">
                        <div className="space-y-1">
                          {order.items?.map((item: any) => (
                            <div key={item.id} className="flex justify-between text-sm">
                              <span className="text-gray-600">{item.quantity}x {item.name}</span>
                              <span className="font-medium">₹{(item.price * item.quantity).toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                        <span className="text-sm font-bold">Total Amount</span>
                        <span className="text-lg font-bold">₹{order.total.toFixed(2)}</span>
                      </div>

                      {order.status === 'delivered' && (
                        <div className="pt-3 border-t border-gray-100 flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                          {order.items?.map((item: any) => {
                            const hasReviewed = reviews.some(r => r.menu_item_id === item.menu_item_id && r.user_id === user?.uid);
                            return (
                              <button
                                key={item.id}
                                onClick={() => {
                                  const menuItem = menu.find(m => m.id === item.menu_item_id);
                                  if (menuItem) {
                                    setReviewingItem(menuItem);
                                    setIsReviewModalOpen(true);
                                  }
                                }}
                                disabled={hasReviewed}
                                className={cn(
                                  "flex-shrink-0 px-3 py-1.5 rounded-xl text-[10px] font-bold transition-all flex items-center gap-1.5",
                                  hasReviewed 
                                    ? "bg-green-50 text-green-600 cursor-default" 
                                    : "bg-orange-50 text-orange-600 hover:bg-orange-100"
                                )}
                              >
                                {hasReviewed ? <CheckCircle2 size={12} /> : <Star size={12} />}
                                {hasReviewed ? 'Rated' : `Rate ${item.name}`}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {view === 'admin' && (
          <div className="space-y-8">
            {adminSubView === 'overview' ? (
              <>
                <div className="flex justify-between items-center">
                  <h2 className="text-3xl font-bold">Admin Overview</h2>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-[#141414] text-white p-8 rounded-3xl space-y-4">
                    <div className="flex justify-between items-center">
                      <TrendingUp className="text-orange-500" />
                      <span className="text-xs font-bold uppercase tracking-widest opacity-50">Total Revenue</span>
                    </div>
                    <div className="text-4xl font-bold">₹{adminStats?.totalRevenue.toFixed(2) || '0.00'}</div>
                    <div className="text-sm opacity-50">+12.5% from last month</div>
                  </div>
                  
                  <div className="bg-white p-8 rounded-3xl border border-gray-100 space-y-4 shadow-sm">
                    <div className="flex justify-between items-center">
                      <Package className="text-blue-500" />
                      <span className="text-xs font-bold uppercase tracking-widest text-gray-400">Total Orders</span>
                    </div>
                    <div className="text-4xl font-bold">{adminStats?.totalOrders || 0}</div>
                    <div className="text-sm text-gray-400">85% completion rate</div>
                  </div>

                  <div className="bg-white p-8 rounded-3xl border border-gray-100 space-y-4 shadow-sm">
                    <div className="flex justify-between items-center">
                      <Users className="text-green-500" />
                      <span className="text-xs font-bold uppercase tracking-widest text-gray-400">Total Customers</span>
                    </div>
                    <div className="text-4xl font-bold">1,284</div>
                    <div className="text-sm text-gray-400">24 new today</div>
                  </div>
                </div>

                <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="p-6 border-b border-gray-50 flex justify-between items-center">
                    <h3 className="font-bold text-lg">Recent Transactions</h3>
                    <button 
                      onClick={() => setAdminSubView('transactions')}
                      className="text-sm font-medium text-orange-500 hover:underline"
                    >
                      View All
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <div className="min-w-[800px]">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="bg-gray-50 text-xs font-bold uppercase tracking-wider text-gray-400">
                            <th className="px-6 py-4">Order ID</th>
                            <th className="px-6 py-4">Customer</th>
                            <th className="px-6 py-4">Table</th>
                            <th className="px-6 py-4">Amount</th>
                            <th className="px-6 py-4">Payment</th>
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4">Date</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {adminStats?.recentOrders.map((order: Order) => (
                          <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4 font-mono text-sm">#{order.id}</td>
                            <td className="px-6 py-4 font-medium">
                              <div>{order.customer_name}</div>
                              <div className="text-[10px] text-gray-400 font-normal mt-1">
                                {order.items?.map((item: any) => `${item.quantity}x ${item.name}`).join(', ')}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className="px-2 py-1 bg-gray-100 rounded-lg text-xs font-bold">
                                T-{order.table_number}
                              </span>
                            </td>
                            <td className="px-6 py-4 font-bold">₹{order.total.toFixed(2)}</td>
                            <td className="px-6 py-4">
                              {order.payment_method ? (
                                <span className={cn(
                                  "px-2 py-1 rounded-lg text-[10px] font-bold uppercase",
                                  order.payment_method === 'upi' ? "bg-blue-50 text-blue-600" : "bg-purple-50 text-purple-600"
                                )}>
                                  {order.payment_method}
                                </span>
                              ) : (
                                <span className="text-[10px] text-gray-400 italic">Not set</span>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              <span className={cn(
                                "px-2 py-1 rounded-full text-[10px] font-bold uppercase",
                                order.status === 'delivered' ? "bg-green-100 text-green-600" : "bg-orange-100 text-orange-600"
                              )}>
                                {order.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500">
                              {formatTimestamp(order.created_at, 'date')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </>
          ) : (
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => setAdminSubView('overview')}
                    className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                  >
                    <ChevronLeft size={24} />
                  </button>
                  <h2 className="text-3xl font-bold">All Transactions</h2>
                </div>

                <div className="bg-white rounded-3xl border border-gray-100 overflow-x-auto shadow-sm">
                  <div className="min-w-[800px]">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-gray-50 text-xs font-bold uppercase tracking-wider text-gray-400">
                          <th className="px-6 py-4">Order ID</th>
                          <th className="px-6 py-4">Customer</th>
                          <th className="px-6 py-4">Table</th>
                          <th className="px-6 py-4">Amount</th>
                          <th className="px-6 py-4">Payment</th>
                          <th className="px-6 py-4">Status</th>
                          <th className="px-6 py-4">Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {orders.map((order: Order) => (
                          <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4 font-mono text-sm">#{order.id}</td>
                            <td className="px-6 py-4 font-medium">
                              <div>{order.customer_name}</div>
                              <div className="text-[10px] text-gray-400 font-normal mt-1">
                                {order.items?.map((item: any) => `${item.quantity}x ${item.name}`).join(', ')}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className="px-2 py-1 bg-gray-100 rounded-lg text-xs font-bold">
                                T-{order.table_number}
                              </span>
                            </td>
                            <td className="px-6 py-4 font-bold">₹{order.total.toFixed(2)}</td>
                            <td className="px-6 py-4">
                              {order.payment_method ? (
                                <span className={cn(
                                  "px-2 py-1 rounded-lg text-[10px] font-bold uppercase",
                                  order.payment_method === 'upi' ? "bg-blue-50 text-blue-600" : "bg-purple-50 text-purple-600"
                                )}>
                                  {order.payment_method}
                                </span>
                              ) : (
                                <span className="text-[10px] text-gray-400 italic">Not set</span>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              <span className={cn(
                                "px-2 py-1 rounded-full text-[10px] font-bold uppercase",
                                order.status === 'delivered' ? "bg-green-100 text-green-600" : "bg-orange-100 text-orange-600"
                              )}>
                                {order.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500">
                              {formatTimestamp(order.created_at, 'date')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Cart Drawer */}
      <AnimatePresence>
        {isCartOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCartOpen(false)}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60]"
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 h-full w-full max-w-md bg-white z-[70] shadow-2xl flex flex-col"
            >
              <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                <h2 className="text-2xl font-bold">Your Cart</h2>
                <button onClick={() => setIsCartOpen(false)} className="p-2 hover:bg-gray-100 rounded-full">
                  <X size={24} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {checkoutStep === 'cart' && (
                  <>
                    {lastOrderId && orders.find(o => o.id === lastOrderId) && (
                      <div className="mb-6 p-4 bg-orange-50 border border-orange-100 rounded-2xl flex items-center justify-between">
                        <div>
                          <p className="text-xs font-bold text-orange-400 uppercase tracking-widest">Active Order #{lastOrderId}</p>
                          <p className="font-bold text-orange-600 capitalize">{orders.find(o => o.id === lastOrderId)?.status}</p>
                        </div>
                        <div className="flex items-center gap-2 text-orange-600">
                          <Clock size={16} />
                          <span className="text-sm font-bold">In Progress</span>
                        </div>
                      </div>
                    )}
                    {cart.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
                        <div className="bg-gray-100 p-6 rounded-full">
                          <ShoppingBag size={48} className="text-gray-400" />
                        </div>
                        <p className="text-gray-500 font-medium">Your cart is empty</p>
                        <button 
                          onClick={() => setIsCartOpen(false)}
                          className="text-orange-500 font-bold hover:underline"
                        >
                          Start Shopping
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {cart.map(item => (
                          <div key={item.id} className="flex gap-4 items-center">
                            <img 
                              src={item.image_url} 
                              alt={item.name} 
                              className="w-20 h-20 rounded-2xl object-cover"
                              referrerPolicy="no-referrer"
                            />
                            <div className="flex-1">
                              <h4 className="font-bold">{item.name}</h4>
                              <p className="text-orange-500 font-bold">₹{item.price.toFixed(2)}</p>
                              <div className="flex items-center gap-3 mt-2">
                                <button 
                                  onClick={() => updateQuantity(item.id, -1)}
                                  className="p-1 border rounded-lg hover:bg-gray-50"
                                >
                                  <Minus size={14} />
                                </button>
                                <span className="font-bold text-sm">{item.quantity}</span>
                                <button 
                                  onClick={() => updateQuantity(item.id, 1)}
                                  className="p-1 border rounded-lg hover:bg-gray-50"
                                >
                                  <Plus size={14} />
                                </button>
                              </div>
                            </div>
                            <button 
                              onClick={() => removeFromCart(item.id)}
                              className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                            >
                              <Trash2 size={20} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}

                {checkoutStep === 'table' && (
                  <div className="space-y-6">
                    <button 
                      onClick={() => setCheckoutStep('cart')}
                      className="text-sm font-bold text-gray-400 flex items-center gap-1 hover:text-[#141414]"
                    >
                      Back to Cart
                    </button>
                    <h3 className="text-xl font-bold">Table Details</h3>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-wider text-gray-400">Full Name</label>
                        <input 
                          type="text" 
                          value={customerInfo.name}
                          onChange={e => setCustomerInfo(prev => ({ ...prev, name: e.target.value }))}
                          placeholder="John Doe"
                          className="w-full p-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-[#141414] transition-all"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-wider text-gray-400">Table Number</label>
                        <input 
                          type="text" 
                          value={customerInfo.table_number}
                          onChange={e => setCustomerInfo(prev => ({ ...prev, table_number: e.target.value }))}
                          placeholder="Enter Table Number (e.g. 5)"
                          className="w-full p-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-[#141414] transition-all"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {checkoutStep === 'payment' && (
                  <div className="space-y-6">
                    <button 
                      onClick={() => setCheckoutStep('table')}
                      className="text-sm font-bold text-gray-400 flex items-center gap-1 hover:text-[#141414]"
                    >
                      Back to Table
                    </button>
                    <h3 className="text-xl font-bold">Payment Method</h3>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <button 
                        onClick={() => setPaymentMethod('upi')}
                        className={cn(
                          "p-6 rounded-3xl border-2 transition-all flex flex-col items-center gap-3",
                          paymentMethod === 'upi' ? "border-[#141414] bg-white shadow-md" : "border-gray-100 bg-gray-50 hover:border-gray-200"
                        )}
                      >
                        <div className="bg-blue-50 p-3 rounded-2xl">
                          <img src="https://upload.wikimedia.org/wikipedia/commons/e/e1/UPI-Logo-vector.svg" className="h-6" alt="UPI" />
                        </div>
                        <span className="font-bold">UPI Payment</span>
                      </button>

                      <button 
                        onClick={() => setPaymentMethod('cash')}
                        className={cn(
                          "p-6 rounded-3xl border-2 transition-all flex flex-col items-center gap-3",
                          paymentMethod === 'cash' ? "border-[#141414] bg-white shadow-md" : "border-gray-100 bg-gray-50 hover:border-gray-200"
                        )}
                      >
                        <div className="bg-green-50 p-3 rounded-2xl text-green-600">
                          <CreditCard size={24} />
                        </div>
                        <span className="font-bold">Cash on Delivery</span>
                      </button>
                    </div>

                    {paymentMethod === 'upi' && (
                      <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                        <div className="flex items-center justify-between bg-orange-50 p-4 rounded-2xl border border-orange-100">
                          <div className="flex items-center gap-2 text-orange-600">
                            <Clock size={20} />
                            <span className="font-bold">Payment Window</span>
                          </div>
                          <div className="text-xl font-mono font-bold text-orange-600">
                            {Math.floor(paymentTimer / 60)}:{(paymentTimer % 60).toString().padStart(2, '0')}
                          </div>
                        </div>

                        <div className="p-6 border-2 border-[#141414] rounded-3xl bg-white space-y-6">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div>
                                <span className="font-bold block">Scan & Pay</span>
                                <span className="text-xs text-gray-400 font-medium">Use any UPI app to scan</span>
                              </div>
                            </div>
                            <CheckCircle2 className="text-green-500" size={24} />
                          </div>

                          <div className="flex flex-col items-center space-y-4 py-4 bg-gray-50 rounded-2xl border border-gray-100">
                            <div className="bg-white p-4 rounded-2xl shadow-sm">
                              <img 
                                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=upi://pay?pa=bahiballiau@okicici&pn=Abhi%20Kush&am=${lastOrderId ? orders.find(o => o.id === lastOrderId)?.total : 0}&cu=INR`} 
                                alt="Payment QR" 
                                className="w-48 h-48"
                              />
                            </div>
                            <div className="text-center">
                              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">UPI ID</p>
                              <p className="font-mono font-bold text-lg">bahiballiau@okicici</p>
                            </div>
                          </div>
                        </div>

                        <button 
                          onClick={handlePayment}
                          disabled={isProcessingPayment}
                          className="w-full bg-[#141414] text-white py-4 rounded-2xl font-bold hover:bg-[#141414]/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                          {isProcessingPayment ? (
                            <>
                              <Loader2 className="animate-spin" size={20} />
                              Processing...
                            </>
                          ) : (
                            'I have completed the payment'
                          )}
                        </button>
                        
                        {paymentError && (
                          <div className="p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-sm font-medium animate-in fade-in slide-in-from-top-2">
                            {paymentError}
                          </div>
                        )}
                      </div>
                    )}

                    {paymentMethod === 'cash' && (
                      <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                        <div className="p-6 bg-green-50 rounded-3xl border border-green-100 text-center space-y-4">
                          <div className="bg-white w-16 h-16 rounded-full flex items-center justify-center mx-auto text-green-600 shadow-sm">
                            <CheckCircle2 size={32} />
                          </div>
                          <div>
                            <h4 className="font-bold text-green-900">Cash on Delivery Selected</h4>
                            <p className="text-sm text-green-700">Please keep the exact change ready for the delivery person.</p>
                          </div>
                        </div>
                        <button 
                          onClick={handlePayment}
                          disabled={isProcessingPayment}
                          className="w-full mt-6 bg-[#141414] text-white py-4 rounded-2xl font-bold hover:bg-[#141414]/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                          {isProcessingPayment ? (
                            <>
                              <Loader2 className="animate-spin" size={20} />
                              Confirming...
                            </>
                          ) : (
                            'Confirm Order'
                          )}
                        </button>
                        
                        {paymentError && (
                          <div className="mt-4 p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-sm font-medium animate-in fade-in slide-in-from-top-2">
                            {paymentError}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {checkoutStep === 'success' && (
                  <div className="h-full flex flex-col items-center justify-center text-center space-y-6 p-4">
                    <div className="bg-green-100 text-green-600 p-8 rounded-full animate-bounce">
                      <CheckCircle2 size={64} />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-3xl font-bold">Order Confirmed!</h3>
                      <p className="text-gray-500">Your order #{lastOrderId} has been placed.</p>
                    </div>
                    
                    <div className="w-full bg-gray-50 rounded-3xl p-6 border border-gray-100 space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-bold text-gray-400 uppercase tracking-wider">Current Status</span>
                        <span className={cn(
                          "px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest",
                          orders.find(o => o.id === lastOrderId)?.status === 'delivered' ? "bg-green-100 text-green-600" :
                          orders.find(o => o.id === lastOrderId)?.status === 'cancelled' ? "bg-red-100 text-red-600" :
                          "bg-orange-100 text-orange-600"
                        )}>
                          {orders.find(o => o.id === lastOrderId)?.status || 'Processing'}
                        </span>
                      </div>
                      
                      <div className="relative h-2 bg-gray-200 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ 
                            width: orders.find(o => o.id === lastOrderId)?.status === 'delivered' ? '100%' :
                                   orders.find(o => o.id === lastOrderId)?.status === 'preparing' ? '66%' :
                                   orders.find(o => o.id === lastOrderId)?.status === 'pending' ? '33%' : '10%'
                          }}
                          className="absolute h-full bg-orange-500 rounded-full"
                        />
                      </div>
                      
                      <p className="text-sm text-gray-500 italic">
                        {orders.find(o => o.id === lastOrderId)?.status === 'pending' && "Waiting for kitchen to accept your order..."}
                        {orders.find(o => o.id === lastOrderId)?.status === 'preparing' && "Chef is working on your delicious meal!"}
                        {orders.find(o => o.id === lastOrderId)?.status === 'delivered' && "Enjoy your food! It has been delivered."}
                      </p>
                    </div>

                    <button 
                      onClick={() => {
                        setIsCartOpen(false);
                        setCheckoutStep('cart');
                        setLastOrderId(null);
                      }}
                      className="w-full bg-[#141414] text-white py-4 rounded-2xl font-bold"
                    >
                      Back to Home
                    </button>
                  </div>
                )}
              </div>

              {cart.length > 0 && checkoutStep !== 'success' && (
                <div className="p-6 bg-gray-50 border-t border-gray-100 space-y-4">
                  <div className="flex justify-between items-center text-lg">
                    <span className="text-gray-500">Total</span>
                    <span className="font-bold text-2xl">₹{cartTotal.toFixed(2)}</span>
                  </div>
                  {checkoutStep === 'cart' && (
                    <button 
                      onClick={() => setCheckoutStep('table')}
                      className="w-full bg-[#141414] text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2"
                    >
                      Checkout <ChevronRight size={20} />
                    </button>
                  )}
                  {checkoutStep === 'table' && (
                    <button 
                      onClick={handleCheckout}
                      disabled={!customerInfo.name || !customerInfo.table_number || isPlacingOrder}
                      className="w-full bg-[#141414] text-white py-4 rounded-2xl font-bold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {isPlacingOrder ? (
                        <>
                          <Loader2 className="animate-spin" size={20} />
                          Placing Order...
                        </>
                      ) : (
                        'Place Order & Pay'
                      )}
                    </button>
                  )}
                  {checkoutStep === 'payment' && (
                    <div className="grid grid-cols-2 gap-3">
                      <button 
                        onClick={() => {
                          setCheckoutStep('cart');
                          setLastOrderId(null);
                          setPaymentTimer(0);
                        }}
                        className="bg-gray-100 text-gray-600 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-gray-200 transition-colors"
                      >
                        <X size={20} />
                        Quit
                      </button>
                      <button 
                        onClick={handlePayment}
                        disabled={!paymentMethod || isProcessingPayment}
                        className="bg-green-600 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isProcessingPayment ? (
                          <Loader2 className="animate-spin" size={20} />
                        ) : (
                          <CheckCircle2 size={20} />
                        )}
                        {isProcessingPayment ? 'Processing...' : 'Pay'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
    </ErrorBoundary>
  );
}
