import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout/Layout';
import FileUpload from './pages/FileUpload';
import ValidationResults from './pages/ValidationResults';

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<FileUpload />} />
        <Route path="/results/:reportId" element={<ValidationResults />} />
      </Routes>
    </Layout>
  );
}

export default App;
