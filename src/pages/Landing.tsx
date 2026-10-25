import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Check, Scan, Bell, TrendingDown, MessageCircle, FileText, ArrowRight } from 'lucide-react';
import { Footer } from '@/components/Footer';

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-white">
      {/* Navbar semplice */}
      <header className="border-b bg-white/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-xl">
            <span className="bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">RESTOS</span>
          </div>
          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => navigate('/login')}>Accedi</Button>
            <Button className="bg-gradient-to-r from-purple-600 to-pink-600" onClick={() => navigate('/login')}>
              Inizia gratis
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-4 py-16 md:py-24 text-center">
        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-6">
          Smetti di perdere soldi sui prezzi dei fornitori
        </h1>
        <p className="text-xl md:text-2xl text-gray-600 max-w-3xl mx-auto mb-8">
          Scansiona le fatture in 10 secondi, ricevi alert automatici sugli aumenti di prezzo e confronta i fornitori. Risparmia tempo e soldi ogni mese.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-6">
          <Button size="lg" className="bg-gradient-to-r from-purple-600 to-pink-600 text-lg px-8 py-6" onClick={() => navigate('/login')}>
            Prova la Demo gratis <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
          <Button size="lg" variant="outline" className="text-lg px-8 py-6" onClick={() => navigate('/login')}>
            Inizia subito (gratis)
          </Button>
        </div>
        <p className="text-sm text-gray-500">Nessuna carta di credito richiesta · Piano gratuito disponibile</p>
      </section>

      {/* Problema */}
      <section className="bg-white py-16">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-6">Il problema che tutti i ristoratori conoscono</h2>
          <div className="grid md:grid-cols-3 gap-6 text-left">
            <Card className="p-6">
              <p className="font-semibold mb-2">Ore perse a inserire fatture</p>
              <p className="text-gray-600">Ogni settimana devi trascrivere manualmente prodotti e prezzi.</p>
            </Card>
            <Card className="p-6">
              <p className="font-semibold mb-2">Aumenti di prezzo che non noti</p>
              <p className="text-gray-600">I fornitori aumentano i prezzi piano piano e te ne accorgi troppo tardi.</p>
            </Card>
            <Card className="p-6">
              <p className="font-semibold mb-2">Nessun confronto facile</p>
              <p className="text-gray-600">Difficile capire quale fornitore è davvero più conveniente.</p>
            </Card>
          </div>
        </div>
      </section>

      {/* Soluzione / Feature */}
      <section className="py-16 max-w-6xl mx-auto px-4">
        <h2 className="text-3xl font-bold text-center mb-12">Come RESTOS ti fa risparmiare</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          <div className="flex gap-4">
            <Scan className="h-10 w-10 text-purple-600 flex-shrink-0" />
            <div>
              <h3 className="font-bold text-lg mb-2">Scan fatture in 10 secondi</h3>
              <p className="text-gray-600">Fotografa o carica la fattura: prodotti e prezzi vengono estratti automaticamente.</p>
            </div>
          </div>
          <div className="flex gap-4">
            <Bell className="h-10 w-10 text-purple-600 flex-shrink-0" />
            <div>
              <h3 className="font-bold text-lg mb-2">Alert automatici sui prezzi</h3>
              <p className="text-gray-600">Ti avvisa subito quando un prodotto aumenta o diminuisce di prezzo.</p>
            </div>
          </div>
          <div className="flex gap-4">
            <TrendingDown className="h-10 w-10 text-purple-600 flex-shrink-0" />
            <div>
              <h3 className="font-bold text-lg mb-2">Confronto fornitori</h3>
              <p className="text-gray-600">Vedi subito chi ti fa pagare di più e dove puoi risparmiare.</p>
            </div>
          </div>
          <div className="flex gap-4">
            <FileText className="h-10 w-10 text-purple-600 flex-shrink-0" />
            <div>
              <h3 className="font-bold text-lg mb-2">Storico e report</h3>
              <p className="text-gray-600">Tieni traccia di tutti gli ordini e delle fatture in un unico posto.</p>
            </div>
          </div>
          <div className="flex gap-4">
            <MessageCircle className="h-10 w-10 text-purple-600 flex-shrink-0" />
            <div>
              <h3 className="font-bold text-lg mb-2">Ordini WhatsApp</h3>
              <p className="text-gray-600">Invia gli ordini ai fornitori direttamente da WhatsApp con un click.</p>
            </div>
          </div>
          <div className="flex gap-4">
            <Check className="h-10 w-10 text-purple-600 flex-shrink-0" />
            <div>
              <h3 className="font-bold text-lg mb-2">Piano gratuito per iniziare</h3>
              <p className="text-gray-600">Puoi provare subito senza pagare. Aggiorna solo quando ti serve di più.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="bg-white py-16">
        <div className="max-w-5xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">Prezzi semplici e trasparenti</h2>
          <p className="text-gray-600 mb-10">Inizia gratis. Passa a un piano a pagamento solo quando ne hai bisogno.</p>
          <div className="grid md:grid-cols-3 gap-6">
            <Card className="p-6 border-2">
              <h3 className="text-xl font-bold">Free</h3>
              <p className="text-3xl font-bold my-4">€0</p>
              <ul className="text-left space-y-2 text-sm text-gray-600">
                <li>✓ 20 prodotti</li>
                <li>✓ 10 fatture</li>
                <li>✓ 10 scan</li>
              </ul>
            </Card>
            <Card className="p-6 border-2 border-purple-500 relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-purple-600 text-white text-xs px-3 py-1 rounded-full">Più scelto</div>
              <h3 className="text-xl font-bold">Pro</h3>
              <p className="text-3xl font-bold my-4">€9,99<span className="text-base font-normal">/mese</span></p>
              <ul className="text-left space-y-2 text-sm text-gray-600">
                <li>✓ 100 prodotti</li>
                <li>✓ 50 fatture</li>
                <li>✓ 50 scan</li>
              </ul>
            </Card>
            <Card className="p-6 border-2">
              <h3 className="text-xl font-bold">Premium</h3>
              <p className="text-3xl font-bold my-4">€14,99<span className="text-base font-normal">/mese</span></p>
              <ul className="text-left space-y-2 text-sm text-gray-600">
                <li>✓ Illimitato</li>
                <li>✓ Supporto prioritario</li>
              </ul>
            </Card>
          </div>
          <Button size="lg" className="mt-10 bg-gradient-to-r from-purple-600 to-pink-600" onClick={() => navigate('/login')}>
            Inizia gratis adesso
          </Button>
        </div>
      </section>

      {/* CTA finale */}
      <section className="py-20 text-center">
        <h2 className="text-3xl md:text-4xl font-bold mb-4">Pronto a risparmiare tempo e soldi?</h2>
        <p className="text-xl text-gray-600 mb-8">Prova RESTOS oggi. Nessun impegno.</p>
        <Button size="lg" className="bg-gradient-to-r from-purple-600 to-pink-600 text-lg px-10 py-6" onClick={() => navigate('/login')}>
          Prova la Demo gratuita
        </Button>
      </section>

      <Footer />
    </div>
  );
}
