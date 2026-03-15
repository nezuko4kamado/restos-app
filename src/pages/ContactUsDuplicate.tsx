import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Footer } from '@/components/Footer';
import { ArrowLeft, Send, Mail, User, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useLanguage } from '@/lib/i18n';
import { useAuth } from '@/contexts/AuthContext';

interface ContactFormData {
  name: string;
  email: string;
  subject: string;
  message: string;
}

export default function ContactUsDuplicate() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<ContactFormData>({
    name: '',
    email: '',
    subject: '',
    message: '',
  });

  const [errors, setErrors] = useState<Partial<ContactFormData>>({});

  const validateForm = (): boolean => {
    const newErrors: Partial<ContactFormData> = {};

    if (!formData.name.trim()) {
      newErrors.name = t('nameRequired');
    }

    if (!formData.email.trim()) {
      newErrors.email = t('emailRequired');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = t('invalidEmail');
    }

    if (!formData.subject.trim()) {
      newErrors.subject = t('subjectRequired');
    }

    if (!formData.message.trim()) {
      newErrors.message = t('messageRequired');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.functions.invoke('app_8ab304f048_send_contact_email', {
        body: {
          name: formData.name,
          email: formData.email,
          subject: formData.subject,
          message: formData.message,
        },
      });

      if (error) {
        console.error('Error sending message:', error);
        toast.error(t('messageSendError'));
        return;
      }

      toast.success(t('messageSentSuccess'));
      setFormData({
        name: '',
        email: '',
        subject: '',
        message: '',
      });
      setErrors({});
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error(t('messageSendError'));
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    if (errors[name as keyof ContactFormData]) {
      setErrors((prev) => ({
        ...prev,
        [name]: undefined,
      }));
    }
  };

  const handleBack = () => {
    // This is the hash-routed duplicate, always redirect to non-hash routes
    if (user) {
      window.location.href = '/';
    } else {
      window.location.href = '/login';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-purple-50 flex flex-col">
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl">
          <Card className="p-8 bg-white border-none shadow-xl">
            {/* Header */}
            <div className="mb-8">
              <Button
                variant="ghost"
                onClick={handleBack}
                className="mb-4 text-purple-600 hover:text-purple-700 hover:bg-purple-50"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                {t('back')}
              </Button>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-2">
                {t('contactUs')}
              </h1>
              <p className="text-gray-600">{t('contactDescription')}</p>
            </div>

            {/* Contact Form */}
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Name Field */}
              <div className="space-y-2">
                <Label htmlFor="name" className="text-gray-700 font-medium">
                  {t('name')}
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <Input
                    id="name"
                    name="name"
                    type="text"
                    placeholder={t('namePlaceholder')}
                    value={formData.name}
                    onChange={handleInputChange}
                    className={`pl-10 border-gray-300 focus:border-purple-500 focus:ring-purple-500 ${
                      errors.name ? 'border-red-500' : ''
                    }`}
                    disabled={loading}
                  />
                </div>
                {errors.name && (
                  <p className="text-sm text-red-500">{errors.name}</p>
                )}
              </div>

              {/* Email Field */}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-gray-700 font-medium">
                  {t('email')}
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder={t('emailPlaceholder')}
                    value={formData.email}
                    onChange={handleInputChange}
                    className={`pl-10 border-gray-300 focus:border-purple-500 focus:ring-purple-500 ${
                      errors.email ? 'border-red-500' : ''
                    }`}
                    disabled={loading}
                  />
                </div>
                {errors.email && (
                  <p className="text-sm text-red-500">{errors.email}</p>
                )}
              </div>

              {/* Subject Field */}
              <div className="space-y-2">
                <Label htmlFor="subject" className="text-gray-700 font-medium">
                  {t('subject')}
                </Label>
                <div className="relative">
                  <MessageSquare className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <Input
                    id="subject"
                    name="subject"
                    type="text"
                    placeholder={t('subjectPlaceholder')}
                    value={formData.subject}
                    onChange={handleInputChange}
                    className={`pl-10 border-gray-300 focus:border-purple-500 focus:ring-purple-500 ${
                      errors.subject ? 'border-red-500' : ''
                    }`}
                    disabled={loading}
                  />
                </div>
                {errors.subject && (
                  <p className="text-sm text-red-500">{errors.subject}</p>
                )}
              </div>

              {/* Message Field */}
              <div className="space-y-2">
                <Label htmlFor="message" className="text-gray-700 font-medium">
                  {t('message')}
                </Label>
                <Textarea
                  id="message"
                  name="message"
                  placeholder={t('messagePlaceholder')}
                  value={formData.message}
                  onChange={handleInputChange}
                  className={`min-h-[150px] border-gray-300 focus:border-purple-500 focus:ring-purple-500 ${
                    errors.message ? 'border-red-500' : ''
                  }`}
                  disabled={loading}
                />
                {errors.message && (
                  <p className="text-sm text-red-500">{errors.message}</p>
                )}
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold py-6 text-base shadow-lg hover:shadow-xl transition-all"
                disabled={loading}
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    <span>{t('sending')}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Send className="h-5 w-5" />
                    <span>{t('send')}</span>
                  </div>
                )}
              </Button>

              {/* Note */}
              <div className="mt-6 p-4 bg-purple-50 rounded-lg border border-purple-200">
                <p className="text-sm text-gray-600">
                  <span className="font-semibold text-purple-600">{t('note')}:</span>{' '}
                  {t('contactNote')}
                </p>
              </div>
            </form>
          </Card>
        </div>
      </div>

      {/* Footer */}
      <Footer />
    </div>
  );
}