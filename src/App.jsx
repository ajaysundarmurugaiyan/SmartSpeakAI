import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Home from './pages/Home';
import TextChat from './pages/TextChat';
import DailyActivities from './pages/DailyActivitiesNew';
import Profile from './pages/Profile';
import QuizPage from './pages/QuizPage';
import Admin from './pages/Admin';
import SpeakingPracticeActivity from './pages/SpeakingPracticeActivity';
import ConversationChallengeActivity from './pages/ConversationChallengeActivity';
import UpdatePassword from './pages/UpdatePassword';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route
            path="/home"
            element={
              <ProtectedRoute>
                <Home />
              </ProtectedRoute>
            }
          />
          <Route
            path="/text-chat"
            element={
              <ProtectedRoute>
                <TextChat />
              </ProtectedRoute>
            }
          />
          <Route
            path="/activities"
            element={
              <ProtectedRoute>
                <DailyActivities />
              </ProtectedRoute>
            }
          />
          <Route
            path="/activity/:activityId"
            element={
              <ProtectedRoute>
                <QuizPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/speaking-practice"
            element={
              <ProtectedRoute>
                <SpeakingPracticeActivity />
              </ProtectedRoute>
            }
          />
          <Route
            path="/conversation-challenge"
            element={
              <ProtectedRoute>
                <ConversationChallengeActivity />
              </ProtectedRoute>
            }
          />
          <Route
            path="/update-password"
            element={<UpdatePassword />}
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <AdminRoute>
                <Admin />
              </AdminRoute>
            }
          />
          <Route path="/" element={<Navigate to="/login" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
