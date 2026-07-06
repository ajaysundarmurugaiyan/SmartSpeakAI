// Activity Tracking Service
import { doc, setDoc, getDoc, updateDoc, increment, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';

class ActivityTracker {
  constructor() {
    this.sessionStartTime = null;
    this.activityLog = [];
    this.currentUserId = null;
  }

  // Start tracking user session
  startSession(userId) {
    this.currentUserId = userId;
    this.sessionStartTime = new Date();
    console.log('📊 Activity tracking started for user:', userId);
  }

  // End session and save data
  async endSession() {
    if (!this.sessionStartTime || !this.currentUserId) return;

    const sessionDuration = this.calculateDuration();
    await this.updateUserActivity(sessionDuration);
    
    this.sessionStartTime = null;
    console.log('📊 Session ended. Duration:', sessionDuration, 'minutes');
  }

  // Calculate session duration in minutes
  calculateDuration() {
    if (!this.sessionStartTime) return 0;
    const now = new Date();
    const durationMs = now - this.sessionStartTime;
    return Math.floor(durationMs / 60000); // Convert to minutes
  }

  // Log user activity
  logActivity(activityType, details = {}) {
    const activity = {
      type: activityType,
      timestamp: new Date().toISOString(),
      ...details
    };
    this.activityLog.push(activity);
    console.log('📝 Activity logged:', activityType);
  }

  // Update user activity in Firestore
  async updateUserActivity(durationMinutes) {
    if (!this.currentUserId) return;

    try {
      const userRef = doc(db, 'users', this.currentUserId);
      const userDoc = await getDoc(userRef);

      if (userDoc.exists()) {
        const currentHours = userDoc.data().hoursLearned || 0;
        const additionalHours = parseFloat((durationMinutes / 60).toFixed(2));

        await updateDoc(userRef, {
          hoursLearned: currentHours + additionalHours,
          lastActive: serverTimestamp(),
          totalSessions: increment(1)
        });

        console.log('✅ User activity updated:', additionalHours, 'hours added');
      }
    } catch (error) {
      console.error('Error updating user activity:', error);
    }
  }

  // Track daily streak
  async updateStreak(userId) {
    try {
      const userRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userRef);

      if (userDoc.exists()) {
        const userData = userDoc.data();
        const lastStreakUpdate = userData.lastStreakUpdate?.toDate();
        
        // Get today's date at midnight
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let newStreak = userData.streak || 0;
        let shouldUpdate = false;

        if (lastStreakUpdate) {
          // Get last update date at midnight
          const lastUpdateDate = new Date(lastStreakUpdate);
          lastUpdateDate.setHours(0, 0, 0, 0);
          
          // Calculate days difference
          const daysDiff = Math.floor((today - lastUpdateDate) / (1000 * 60 * 60 * 24));

          if (daysDiff === 0) {
            // Same day - no update needed
            console.log('🔥 Streak already updated today:', newStreak, 'days');
            return newStreak;
          } else if (daysDiff === 1) {
            // Consecutive day - increment streak
            newStreak += 1;
            shouldUpdate = true;
            console.log('✅ Consecutive login! Streak increased to:', newStreak, 'days');
          } else if (daysDiff > 1) {
            // Missed day(s) - reset streak
            newStreak = 1;
            shouldUpdate = true;
            console.log('❌ Streak broken! Starting fresh. Days missed:', daysDiff - 1);
          }
        } else {
          // First time user or no streak data
          newStreak = 1;
          shouldUpdate = true;
          console.log('🎉 First login! Starting streak at 1 day');
        }

        if (shouldUpdate) {
          // Update best streak if current streak is higher
          const currentBestStreak = userData.bestStreak || 0;
          const updateData = {
            streak: newStreak,
            lastStreakUpdate: serverTimestamp(),
            lastActive: serverTimestamp()
          };
          
          if (newStreak > currentBestStreak) {
            updateData.bestStreak = newStreak;
            console.log('🏆 New best streak achieved:', newStreak, 'days');
          }

          await updateDoc(userRef, updateData);
          console.log('🔥 Streak updated:', newStreak, 'days');
        }

        return newStreak;
      }
    } catch (error) {
      console.error('Error updating streak:', error);
    }
  }

  // Get user statistics
  async getUserStats(userId) {
    try {
      const userRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userRef);

      if (userDoc.exists()) {
        const data = userDoc.data();
        return {
          hoursLearned: data.hoursLearned || 0,
          totalLessons: data.totalLessons || 0,
          streak: data.streak || 0,
          bestStreak: data.bestStreak || 0,
          level: data.level || 'Beginner',
          totalSessions: data.totalSessions || 0,
          lastActive: data.lastActive
        };
      }
    } catch (error) {
      console.error('Error getting user stats:', error);
    }
    return null;
  }

  // Track lesson completion
  async completLesson(userId, lessonId, score) {
    try {
      const userRef = doc(db, 'users', userId);
      
      await updateDoc(userRef, {
        totalLessons: increment(1),
        lastActive: serverTimestamp()
      });

      // Save lesson score
      const lessonRef = doc(db, 'users', userId, 'lessons', lessonId);
      await setDoc(lessonRef, {
        lessonId,
        score,
        completedAt: serverTimestamp(),
        attempts: increment(1)
      }, { merge: true });

      console.log('✅ Lesson completed:', lessonId, 'Score:', score);
    } catch (error) {
      console.error('Error completing lesson:', error);
    }
  }

  // Get activity summary
  getActivitySummary() {
    return {
      sessionDuration: this.calculateDuration(),
      activitiesCount: this.activityLog.length,
      activities: this.activityLog
    };
  }
}

export default new ActivityTracker();
