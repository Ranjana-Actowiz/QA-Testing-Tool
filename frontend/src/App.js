import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout/Layout';
import FileUpload from './pages/FileUpload';
import ValidationResults from './pages/ValidationResults';

// import RuleConfig from './pages/RuleConfig';
// import Dashboard from './pages/Dashboard';

function App() {
  return (
    <Layout>
      <Routes>
        {/* <Route path="/" element={<Dashboard />} /> */}
        <Route path="/" element={<FileUpload />} />
        {/* <Route path="/validate/:uploadId" element={<RuleConfig />} /> */}
        <Route path="/results/:reportId" element={<ValidationResults />} />
      </Routes>
    </Layout>
  );
}

export default App;
