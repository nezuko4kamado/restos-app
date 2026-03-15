import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = 'https://tmxmkvinsvuzbzrjrucw.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRteG1rdmluc3Z1emJ6cmpydWN3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjkzNzg4MiwiZXhwIjoyMDc4NTEzODgyfQ.gG6Y3LlCw8dzEVNtrR4luV1dx2nJ2JajJxCT3Jlv-Zw';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDuplicates() {
  console.log('🔍 Connecting to Supabase database...');
  
  try {
    // Get all products
    const { data: products, error } = await supabase
      .from('products')
      .select('id, name, vat_rate, created_at, supplier_id')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error fetching products:', error);
      return;
    }

    console.log(`✅ Fetched ${products.length} total products from database`);

    // Group products by normalized name
    const productGroups = {};
    
    products.forEach(product => {
      const normalizedName = product.name.trim().toLowerCase();
      if (!productGroups[normalizedName]) {
        productGroups[normalizedName] = [];
      }
      productGroups[normalizedName].push(product);
    });

    // Find duplicates
    const duplicates = Object.entries(productGroups)
      .filter(([name, products]) => products.length > 1)
      .sort((a, b) => b[1].length - a[1].length);

    console.log(`\n📊 Found ${duplicates.length} products with duplicates`);
    
    // Generate report
    let report = '# Database Duplicates Report\n\n';
    report += `**Generated:** ${new Date().toISOString()}\n\n`;
    report += `**Total Products in Database:** ${products.length}\n`;
    report += `**Products with Duplicates:** ${duplicates.length}\n`;
    report += `**Total Duplicate Records:** ${duplicates.reduce((sum, [_, prods]) => sum + prods.length - 1, 0)}\n\n`;
    report += '---\n\n';

    if (duplicates.length === 0) {
      report += '✅ **No duplicate products found in the database!**\n';
    } else {
      report += '## Duplicate Products Details\n\n';
      
      duplicates.forEach(([normalizedName, productVersions], index) => {
        report += `### ${index + 1}. ${productVersions[0].name}\n\n`;
        report += `- **Normalized Name:** \`${normalizedName}\`\n`;
        report += `- **Number of Duplicates:** ${productVersions.length}\n\n`;
        report += '| ID | VAT Rate | Created At | Supplier ID |\n';
        report += '|----|----------|------------|-------------|\n';
        
        productVersions.forEach(product => {
          const createdDate = new Date(product.created_at).toLocaleString();
          report += `| \`${product.id}\` | ${product.vat_rate || 0}% | ${createdDate} | \`${product.supplier_id || 'N/A'}\` |\n`;
        });
        
        report += '\n';
      });

      report += '---\n\n';
      report += '## Recommended Actions\n\n';
      report += '1. **Review the duplicates** above to understand which versions should be kept\n';
      report += '2. **Run the cleanup script** in `sql_cleanup/cleanup_duplicate_products.sql` to remove duplicates\n';
      report += '3. **Verify the results** after cleanup by running this check again\n\n';
      report += '⚠️ **Note:** The cleanup script will keep only the most recent version (latest `created_at`) of each product.\n';
    }

    // Save report
    const reportPath = '/workspace/shadcn-ui/sql_cleanup/database_duplicates_report.md';
    fs.writeFileSync(reportPath, report);
    console.log(`\n✅ Report saved to: ${reportPath}`);
    
    // Print summary to console
    console.log('\n' + '='.repeat(60));
    console.log('SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total Products: ${products.length}`);
    console.log(`Products with Duplicates: ${duplicates.length}`);
    console.log(`Total Duplicate Records to Remove: ${duplicates.reduce((sum, [_, prods]) => sum + prods.length - 1, 0)}`);
    
    if (duplicates.length > 0) {
      console.log('\nTop Duplicates:');
      duplicates.slice(0, 5).forEach(([name, prods]) => {
        console.log(`  - "${prods[0].name}": ${prods.length} versions`);
      });
    }
    console.log('='.repeat(60));

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

checkDuplicates();
