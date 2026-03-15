import { supabase } from './supabase';
import type { ProductCompatibility, OrderImage, SearchFilter } from '@/types';

// ============================================
// PRODUCT COMPATIBILITY FUNCTIONS
// ============================================

export const getProductCompatibility = async (productId: string): Promise<ProductCompatibility[]> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('product_compatibility')
      .select('*')
      .or(`product_id_1.eq.${productId},product_id_2.eq.${productId}`)
      .eq('user_id', user.id);

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('❌ Error fetching product compatibility:', error);
    return [];
  }
};

export const saveProductCompatibility = async (
  productId1: string,
  productId2: string
): Promise<void> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // Ensure product_id_1 is always the smaller ID for consistency
    const [pid1, pid2] = [productId1, productId2].sort();

    const { error } = await supabase
      .from('product_compatibility')
      .upsert({
        product_id_1: pid1,
        product_id_2: pid2,
        user_id: user.id,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'product_id_1,product_id_2,user_id'
      });

    if (error) throw error;
    console.log('✅ Product compatibility saved');
  } catch (error) {
    console.error('❌ Error saving product compatibility:', error);
    throw error;
  }
};

export const deleteProductCompatibility = async (compatibilityId: string): Promise<void> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { error } = await supabase
      .from('product_compatibility')
      .delete()
      .eq('id', compatibilityId)
      .eq('user_id', user.id);

    if (error) throw error;
    console.log('✅ Product compatibility deleted');
  } catch (error) {
    console.error('❌ Error deleting product compatibility:', error);
    throw error;
  }
};

// ============================================
// ORDER IMAGES FUNCTIONS
// ============================================

export const getOrderImages = async (orderId: string): Promise<OrderImage[]> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('order_images')
      .select('*')
      .eq('order_id', orderId)
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('❌ Error fetching order images:', error);
    return [];
  }
};

export const uploadOrderImage = async (
  orderId: string,
  file: File
): Promise<OrderImage | null> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // Upload file to Supabase Storage
    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}/${orderId}/${Date.now()}.${fileExt}`;
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('order-images')
      .upload(fileName, file);

    if (uploadError) throw uploadError;

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('order-images')
      .getPublicUrl(fileName);

    // Save metadata to database
    const { data, error } = await supabase
      .from('order_images')
      .insert({
        order_id: orderId,
        image_url: publicUrl,
        image_name: file.name,
        image_size: file.size,
        user_id: user.id
      })
      .select()
      .single();

    if (error) throw error;
    console.log('✅ Order image uploaded:', fileName);
    return data;
  } catch (error) {
    console.error('❌ Error uploading order image:', error);
    throw error;
  }
};

export const deleteOrderImage = async (imageId: string, imageUrl: string): Promise<void> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // Extract file path from URL
    const urlParts = imageUrl.split('/order-images/');
    if (urlParts.length > 1) {
      const filePath = urlParts[1];
      
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('order-images')
        .remove([filePath]);

      if (storageError) console.error('Storage delete error:', storageError);
    }

    // Delete from database
    const { error } = await supabase
      .from('order_images')
      .delete()
      .eq('id', imageId)
      .eq('user_id', user.id);

    if (error) throw error;
    console.log('✅ Order image deleted');
  } catch (error) {
    console.error('❌ Error deleting order image:', error);
    throw error;
  }
};

export const deleteAllOrderImages = async (orderId: string): Promise<void> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // Get all images for this order
    const images = await getOrderImages(orderId);

    // Delete each image
    for (const image of images) {
      await deleteOrderImage(image.id, image.image_url);
    }

    console.log('✅ All order images deleted');
  } catch (error) {
    console.error('❌ Error deleting all order images:', error);
    throw error;
  }
};

// ============================================
// SEARCH FILTERS FUNCTIONS
// ============================================

export const getSearchFilters = async (): Promise<SearchFilter[]> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('search_filters')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('❌ Error fetching search filters:', error);
    return [];
  }
};

export const saveSearchFilter = async (
  filterName: string,
  filterData: SearchFilter['filter_data']
): Promise<void> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { error } = await supabase
      .from('search_filters')
      .upsert({
        user_id: user.id,
        filter_name: filterName,
        filter_data: filterData,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,filter_name'
      });

    if (error) throw error;
    console.log('✅ Search filter saved:', filterName);
  } catch (error) {
    console.error('❌ Error saving search filter:', error);
    throw error;
  }
};

export const deleteSearchFilter = async (filterId: string): Promise<void> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { error } = await supabase
      .from('search_filters')
      .delete()
      .eq('id', filterId)
      .eq('user_id', user.id);

    if (error) throw error;
    console.log('✅ Search filter deleted');
  } catch (error) {
    console.error('❌ Error deleting search filter:', error);
    throw error;
  }
};