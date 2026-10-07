import React from 'react';
import ReactApexChart from 'react-apexcharts';

export default function DIChartRenderer({ chartType, categories, data }) {
  const chartOptions = {
    chart: { toolbar: { show: false }, background: 'transparent' },
    theme: { mode: 'dark' },
    xaxis: { categories: categories || [] },
    colors: ['#6366f1', '#ec4899', '#10b981', '#f59e0b'],
  };

  const chartSeries = [{
    name: 'Dataset',
    data: data || []
  }];

  return (
    <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 shadow-lg w-full">
      <ReactApexChart 
        options={chartOptions} 
        series={chartSeries} 
        type={chartType || 'bar'} 
        height={350} 
      />
    </div>
  );
}