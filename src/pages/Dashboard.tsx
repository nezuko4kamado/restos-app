import { useState, useEffect } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import ProductsSection from '@/components/ProductsSection'
import OrdersSectionEnhanced from '@/components/OrdersSectionEnhanced'
import { SubscriptionManager } from '@/components/SubscriptionManager'
import { supabase } from '@/lib/supabase'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { LogOut, CreditCard } from 'lucide-react'
import { User } from '@supabase/supabase-js'

export default function Dashboard() {
  const [user, setUser] = useState<User | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    checkUser()
  }, [])

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      navigate('/login')
    } else {
      setUser(user)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">{user.email}</span>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Esci
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="products" className="space-y-6">
          <TabsList>
            <TabsTrigger value="products">Prodotti</TabsTrigger>
            <TabsTrigger value="orders">Ordini</TabsTrigger>
            <TabsTrigger value="subscription">
              <CreditCard className="h-4 w-4 mr-2" />
              Abbonamenti
            </TabsTrigger>
          </TabsList>

          <TabsContent value="products">
            <ProductsSection />
          </TabsContent>

          <TabsContent value="orders">
            <OrdersSectionEnhanced />
          </TabsContent>

          <TabsContent value="subscription">
            <SubscriptionManager />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}