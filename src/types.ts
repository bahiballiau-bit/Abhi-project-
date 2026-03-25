export interface Category {
  id: string;
  name: string;
}

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  category_id: string;
  category_name?: string;
  image_url: string;
  available: boolean;
}

export interface CartItem extends MenuItem {
  quantity: number;
}

export interface Order {
  id: string;
  customer_name: string;
  table_number: string;
  total: number;
  status: 'pending' | 'accepted' | 'preparing' | 'ready' | 'delivered' | 'rejected' | 'cancelled';
  created_at: any; // Firestore Timestamp
  uid: string;
  items?: OrderItem[];
  payment_method?: 'upi' | 'cash';
}

export interface UserProfile {
  name: string;
  mobile: string;
  email: string;
  photo_url: string;
  role?: 'user' | 'restaurant' | 'admin';
}

export interface OrderItem {
  id: string;
  order_id: string;
  menu_item_id: string;
  name: string;
  image_url: string;
  quantity: number;
  price: number;
}

export interface Review {
  id: string;
  menu_item_id: string;
  user_id: string;
  user_name: string;
  user_photo?: string;
  rating: number;
  comment: string;
  created_at: any;
}

export type View = 'user' | 'restaurant' | 'admin' | 'profile';
