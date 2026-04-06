import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout/Layout';
import FileUpload from './pages/FileUpload';
import ValidationResults from './pages/ValidationResults';
import RuleConfig from './pages/RuleConfig';

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<FileUpload />} />
        <Route path="/upload/:uploadId" element={<RuleConfig />} />
        <Route path="/results/:reportId" element={<ValidationResults />} />
      </Routes>
    </Layout>
  );
}

export default App;
