/**
 * Internationalization Service
 * 
 * Multi-language support with automatic detection and caching
 * Integrates with platform caching and content management
 */

import { PublicApiSingleton } from '../providers/base/PublicApiSingleton';

export interface Language {
  code: string;
  name: string;
  nativeName: string;
  flag: string;
  rtl: boolean;
  default: boolean;
}

export interface TranslationNamespace {
  common: Record<string, string>;
  products: Record<string, string>;
  navigation: Record<string, string>;
  errors: Record<string, string>;
  checkout: Record<string, string>;
  reviews: Record<string, string>;
  analytics: Record<string, string>;
}

export interface TranslationContext {
  language: string;
  region?: string;
  currency?: string;
  dateFormat?: string;
  numberFormat?: string;
}

/**
 * Internationalization Service
 * 
 * Provides multi-language support with automatic detection
 * Leverages platform caching for optimal performance
 */
class InternationalizationService extends PublicApiSingleton {
  private static instance: InternationalizationService;
  private currentLanguage: string = 'en';
  private translations: Map<string, TranslationNamespace> = new Map();
  private supportedLanguages: Language[] = [
    { code: 'en', name: 'English', nativeName: 'English', flag: '🇺🇸', rtl: false, default: true },
    { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸', rtl: false, default: false },
    { code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷', rtl: false, default: false },
    { code: 'de', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪', rtl: false, default: false },
    { code: 'it', name: 'Italian', nativeName: 'Italiano', flag: '🇮🇹', rtl: false, default: false },
    { code: 'pt', name: 'Portuguese', nativeName: 'Português', flag: '🇵🇹', rtl: false, default: false },
    { code: 'ru', name: 'Russian', nativeName: 'Русский', flag: '🇷🇺', rtl: false, default: false },
    { code: 'ja', name: 'Japanese', nativeName: '日本語', flag: '🇯🇵', rtl: false, default: false },
    { code: 'zh', name: 'Chinese', nativeName: '中文', flag: '🇨🇳', rtl: false, default: false },
    { code: 'ar', name: 'Arabic', nativeName: 'العربية', flag: '🇸🇦', rtl: true, default: false },
    { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', flag: '🇮🇳', rtl: false, default: false },
    { code: 'ko', name: 'Korean', nativeName: '한국어', flag: '🇰🇷', rtl: false, default: false }
  ];

  private constructor() {
    super('internationalization-service', { encrypt: false });
    this.initializeLanguage();
  }

  public static getInstance(): InternationalizationService {
    if (!InternationalizationService.instance) {
      InternationalizationService.instance = new InternationalizationService();
    }
    return InternationalizationService.instance;
  }

  /**
   * Initialize language based on user preferences or browser settings
   */
  private initializeLanguage(): void {
    if (typeof window !== 'undefined') {
      // Check localStorage first
      const savedLanguage = localStorage.getItem('preferred_language');
      if (savedLanguage && this.isLanguageSupported(savedLanguage)) {
        this.currentLanguage = savedLanguage;
        return;
      }

      // Check browser language
      const browserLanguage = navigator.language.split('-')[0];
      if (this.isLanguageSupported(browserLanguage)) {
        this.currentLanguage = browserLanguage;
        localStorage.setItem('preferred_language', browserLanguage);
        return;
      }

      // Fall back to default
      this.currentLanguage = 'en';
    }
  }

  /**
   * Get current language
   */
  getCurrentLanguage(): string {
    return this.currentLanguage;
  }

  /**
   * Set current language
   */
  async setLanguage(languageCode: string): Promise<void> {
    if (!this.isLanguageSupported(languageCode)) {
      console.warn(`[InternationalizationService] Language ${languageCode} is not supported`);
      return;
    }

    this.currentLanguage = languageCode;
    
    if (typeof window !== 'undefined') {
      localStorage.setItem('preferred_language', languageCode);
      document.documentElement.lang = languageCode;
      document.documentElement.dir = this.getLanguage(languageCode)?.rtl ? 'rtl' : 'ltr';
    }

    // Preload translations for the new language
    await this.loadTranslations(languageCode);
  }

  /**
   * Get supported languages
   */
  getSupportedLanguages(): Language[] {
    return this.supportedLanguages;
  }

  /**
   * Get language info
   */
  getLanguage(languageCode?: string): Language | undefined {
    return this.supportedLanguages.find(lang => lang.code === (languageCode || this.currentLanguage));
  }

  /**
   * Check if language is supported
   */
  isLanguageSupported(languageCode: string): boolean {
    return this.supportedLanguages.some(lang => lang.code === languageCode);
  }

  /**
   * Translate a key
   */
  async translate(
    key: string,
    namespace: keyof TranslationNamespace = 'common',
    variables: Record<string, string | number> = {},
    languageCode?: string
  ): Promise<string> {
    const lang = languageCode || this.currentLanguage;
    const translations = await this.getTranslations(lang);
    
    let translation = translations[namespace][key] || key;
    
    // Replace variables
    Object.entries(variables).forEach(([variable, value]) => {
      translation = translation.replace(new RegExp(`{{\\s*${variable}\\s*}}`, 'g'), String(value));
    });
    
    return translation;
  }

  /**
   * Translate multiple keys
   */
  async translateBatch(
    keys: Array<{ key: string; namespace?: keyof TranslationNamespace; variables?: Record<string, string | number> }>,
    languageCode?: string
  ): Promise<Record<string, string>> {
    const results: Record<string, string> = {};
    
    for (const { key, namespace = 'common', variables = {} } of keys) {
      results[key] = await this.translate(key, namespace, variables, languageCode);
    }
    
    return results;
  }

  /**
   * Format currency
   */
  formatCurrency(
    amount: number,
    currency: string = 'USD',
    languageCode?: string
  ): string {
    const lang = languageCode || this.currentLanguage;
    
    try {
      return new Intl.NumberFormat(lang, {
        style: 'currency',
        currency: currency
      }).format(amount);
    } catch (error) {
      console.warn(`[InternationalizationService] Failed to format currency for ${lang}`, error);
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency
      }).format(amount);
    }
  }

  /**
   * Format number
   */
  formatNumber(
    number: number,
    options: Intl.NumberFormatOptions = {},
    languageCode?: string
  ): string {
    const lang = languageCode || this.currentLanguage;
    
    try {
      return new Intl.NumberFormat(lang, options).format(number);
    } catch (error) {
      console.warn(`[InternationalizationService] Failed to format number for ${lang}`, error);
      return new Intl.NumberFormat('en-US', options).format(number);
    }
  }

  /**
   * Format date
   */
  formatDate(
    date: Date | string | number,
    options: Intl.DateTimeFormatOptions = {},
    languageCode?: string
  ): string {
    const lang = languageCode || this.currentLanguage;
    const dateObj = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
    
    try {
      return new Intl.DateTimeFormat(lang, options).format(dateObj);
    } catch (error) {
      console.warn(`[InternationalizationService] Failed to format date for ${lang}`, error);
      return new Intl.DateTimeFormat('en-US', options).format(dateObj);
    }
  }

  /**
   * Format relative time
   */
  formatRelativeTime(
    date: Date | string | number,
    languageCode?: string
  ): string {
    const lang = languageCode || this.currentLanguage;
    const dateObj = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
    
    try {
      const rtf = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' });
      const diff = dateObj.getTime() - Date.now();
      const diffDays = Math.round(diff / (1000 * 60 * 60 * 24));
      
      return rtf.format(diffDays, 'day');
    } catch (error) {
      console.warn(`[InternationalizationService] Failed to format relative time for ${lang}`, error);
      return dateObj.toLocaleDateString();
    }
  }

  /**
   * Get translations for a language
   */
  async getTranslations(languageCode: string): Promise<TranslationNamespace> {
    if (this.translations.has(languageCode)) {
      return this.translations.get(languageCode)!;
    }

    return await this.loadTranslations(languageCode);
  }

  /**
   * Load translations for a language
   */
  private async loadTranslations(languageCode: string): Promise<TranslationNamespace> {
    try {
      const cacheKey = `i18n-translations-${languageCode}`;
      
      const response = await this.makeDefaultRequest<{
        translations: TranslationNamespace;
      }>(
        `/api/i18n/translations/${languageCode}`,
        {},
        cacheKey,
        60 * 60 * 1000 // 1 hour cache for translations
      );

      if (!response.success) {
        console.error(`[InternationalizationService] Failed to load translations for ${languageCode}:`, response.error);
        return this.getDefaultTranslations();
      }

      const translations = response.data?.translations || this.getDefaultTranslations();
      this.translations.set(languageCode, translations);
      
      return translations;
    } catch (error) {
      console.error(`[InternationalizationService] Error loading translations for ${languageCode}:`, error);
      return this.getDefaultTranslations();
    }
  }

  /**
   * Get default translations (English fallback)
   */
  private getDefaultTranslations(): TranslationNamespace {
    return {
      common: {
        loading: 'Loading...',
        error: 'An error occurred',
        retry: 'Retry',
        cancel: 'Cancel',
        save: 'Save',
        delete: 'Delete',
        edit: 'Edit',
        close: 'Close',
        search: 'Search',
        filter: 'Filter',
        sort: 'Sort',
        more: 'More',
        less: 'Less',
        yes: 'Yes',
        no: 'No',
        ok: 'OK',
        back: 'Back',
        next: 'Next',
        previous: 'Previous',
        submit: 'Submit',
        clear: 'Clear',
        reset: 'Reset',
        apply: 'Apply',
        select: 'Select',
        all: 'All',
        none: 'None',
        other: 'Other',
        unknown: 'Unknown',
        optional: 'Optional',
        required: 'Required',
        recommended: 'Recommended',
        featured: 'Featured',
        trending: 'Trending',
        new: 'New',
        popular: 'Popular',
        sale: 'Sale',
        discount: 'Discount',
        free: 'Free',
        premium: 'Premium',
        verified: 'Verified',
        authentic: 'Authentic',
        official: 'Official'
      },
      products: {
        product: 'Product',
        products: 'Products',
        price: 'Price',
        quantity: 'Quantity',
        in_stock: 'In Stock',
        out_of_stock: 'Out of Stock',
        low_stock: 'Low Stock',
        limited_stock: 'Limited Stock',
        add_to_cart: 'Add to Cart',
        buy_now: 'Buy Now',
        wishlist: 'Wishlist',
        compare: 'Compare',
        share: 'Share',
        review: 'Review',
        reviews: 'Reviews',
        rating: 'Rating',
        ratings: 'Ratings',
        description: 'Description',
        specifications: 'Specifications',
        features: 'Features',
        details: 'Details',
        images: 'Images',
        video: 'Video',
        variant: 'Variant',
        variants: 'Variants',
        options: 'Options',
        size: 'Size',
        color: 'Color',
        material: 'Material',
        brand: 'Brand',
        category: 'Category',
        categories: 'Categories',
        tags: 'Tags',
        sku: 'SKU',
        isbn: 'ISBN',
        model: 'Model',
        style: 'Style',
        condition: 'Condition',
        availability: 'Availability',
        shipping: 'Shipping',
        delivery: 'Delivery',
        returns: 'Returns',
        warranty: 'Warranty',
        guarantee: 'Guarantee'
      },
      navigation: {
        home: 'Home',
        about: 'About',
        contact: 'Contact',
        help: 'Help',
        support: 'Support',
        faq: 'FAQ',
        terms: 'Terms',
        privacy: 'Privacy',
        login: 'Login',
        logout: 'Logout',
        register: 'Register',
        profile: 'Profile',
        account: 'Account',
        settings: 'Settings',
        dashboard: 'Dashboard',
        orders: 'Orders',
        cart: 'Cart',
        checkout: 'Checkout',
        payment: 'Payment',
        shipping: 'Shipping',
        billing: 'Billing',
        history: 'History',
        favorites: 'Favorites',
        notifications: 'Notifications'
      },
      errors: {
        not_found: 'Not Found',
        unauthorized: 'Unauthorized',
        forbidden: 'Forbidden',
        server_error: 'Server Error',
        network_error: 'Network Error',
        validation_error: 'Validation Error',
        file_not_found: 'File Not Found',
        invalid_format: 'Invalid Format',
        too_large: 'File Too Large',
        unsupported_type: 'Unsupported File Type',
        session_expired: 'Session Expired',
        access_denied: 'Access Denied',
        quota_exceeded: 'Quota Exceeded',
        rate_limited: 'Rate Limited',
        maintenance: 'Under Maintenance'
      },
      checkout: {
        checkout: 'Checkout',
        payment: 'Payment',
        billing: 'Billing',
        shipping: 'Shipping',
        summary: 'Summary',
        total: 'Total',
        subtotal: 'Subtotal',
        tax: 'Tax',
        discount: 'Discount',
        coupon: 'Coupon',
        promo_code: 'Promo Code',
        gift_card: 'Gift Card',
        credit_card: 'Credit Card',
        debit_card: 'Debit Card',
        paypal: 'PayPal',
        apple_pay: 'Apple Pay',
        google_pay: 'Google Pay',
        bank_transfer: 'Bank Transfer',
        cash_on_delivery: 'Cash on Delivery',
        place_order: 'Place Order',
        processing: 'Processing',
        completed: 'Completed',
        failed: 'Failed',
        cancelled: 'Cancelled',
        refunded: 'Refunded'
      },
      reviews: {
        review: 'Review',
        reviews: 'Reviews',
        write_review: 'Write a Review',
        rating: 'Rating',
        ratings: 'Ratings',
        stars: 'Stars',
        helpful: 'Helpful',
        not_helpful: 'Not Helpful',
        verified_purchase: 'Verified Purchase',
        average_rating: 'Average Rating',
        total_reviews: 'Total Reviews',
        would_recommend: 'Would Recommend',
        filter_by_rating: 'Filter by Rating',
        sort_by: 'Sort by',
        most_recent: 'Most Recent',
        oldest: 'Oldest',
        highest_rating: 'Highest Rating',
        lowest_rating: 'Lowest Rating',
        most_helpful: 'Most Helpful',
        title: 'Title',
        content: 'Content',
        submit_review: 'Submit Review',
        thank_you: 'Thank you for your review!'
      },
      analytics: {
        views: 'Views',
        clicks: 'Clicks',
        conversions: 'Conversions',
        revenue: 'Revenue',
        visitors: 'Visitors',
        sessions: 'Sessions',
        bounce_rate: 'Bounce Rate',
        conversion_rate: 'Conversion Rate',
        average_order_value: 'Average Order Value',
        customer_lifetime_value: 'Customer Lifetime Value',
        retention_rate: 'Retention Rate',
        churn_rate: 'Churn Rate',
        growth_rate: 'Growth Rate',
        engagement_rate: 'Engagement Rate',
        page_views: 'Page Views',
        unique_visitors: 'Unique Visitors',
        returning_visitors: 'Returning Visitors',
        new_visitors: 'New Visitors',
        time_on_site: 'Time on Site',
        pages_per_session: 'Pages per Session'
      }
    };
  }

  /**
   * Detect user's preferred language
   */
  detectPreferredLanguage(): string {
    if (typeof window === 'undefined') {
      return 'en';
    }

    // Check localStorage
    const savedLanguage = localStorage.getItem('preferred_language');
    if (savedLanguage && this.isLanguageSupported(savedLanguage)) {
      return savedLanguage;
    }

    // Check browser language
    const browserLanguage = navigator.language.split('-')[0];
    if (this.isLanguageSupported(browserLanguage)) {
      return browserLanguage;
    }

    // Check Accept-Language header
    const acceptLanguage = navigator.languages?.[0]?.split('-')[0];
    if (acceptLanguage && this.isLanguageSupported(acceptLanguage)) {
      return acceptLanguage;
    }

    // Fall back to default
    return 'en';
  }

  /**
   * Preload translations for multiple languages
   */
  async preloadTranslations(languageCodes: string[]): Promise<void> {
    const promises = languageCodes
      .filter(code => this.isLanguageSupported(code) && !this.translations.has(code))
      .map(code => this.loadTranslations(code));

    await Promise.allSettled(promises);
  }
}

// Export singleton instance
export const internationalizationService = InternationalizationService.getInstance();
export default InternationalizationService;
