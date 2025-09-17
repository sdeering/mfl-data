#!/usr/bin/env python3
"""
Advanced ML Models for MFL Position Rating Prediction
"""

import numpy as np
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.svm import SVR
from sklearn.neural_network import MLPRegressor
from sklearn.model_selection import cross_val_score, GridSearchCV
from sklearn.metrics import mean_absolute_error, r2_score
import xgboost as xgb
import lightgbm as lgb

def train_advanced_models(X_train, y_train, X_test, y_test):
    """
    Train and compare advanced ML models
    """
    
    models = {
        'Random Forest': RandomForestRegressor(
            n_estimators=100,
            max_depth=10,
            random_state=42
        ),
        
        'Gradient Boosting': GradientBoostingRegressor(
            n_estimators=100,
            learning_rate=0.1,
            max_depth=6,
            random_state=42
        ),
        
        'XGBoost': xgb.XGBRegressor(
            n_estimators=100,
            learning_rate=0.1,
            max_depth=6,
            random_state=42
        ),
        
        'LightGBM': lgb.LGBMRegressor(
            n_estimators=100,
            learning_rate=0.1,
            max_depth=6,
            random_state=42
        ),
        
        'SVR (RBF)': SVR(
            kernel='rbf',
            C=1.0,
            gamma='scale'
        ),
        
        'Neural Network': MLPRegressor(
            hidden_layer_sizes=(100, 50),
            activation='relu',
            solver='adam',
            max_iter=500,
            random_state=42
        )
    }
    
    results = {}
    
    for name, model in models.items():
        print(f"Training {name}...")
        
        # Train model
        model.fit(X_train, y_train)
        
        # Predictions
        y_pred = model.predict(X_test)
        
        # Metrics
        mae = mean_absolute_error(y_test, y_pred)
        r2 = r2_score(y_test, y_pred)
        
        # Cross-validation
        cv_scores = cross_val_score(model, X_train, y_train, cv=5, scoring='r2')
        
        results[name] = {
            'MAE': mae,
            'R²': r2,
            'CV_R²_mean': cv_scores.mean(),
            'CV_R²_std': cv_scores.std(),
            'model': model
        }
        
        print(f"{name}: MAE={mae:.2f}, R²={r2:.3f}, CV_R²={cv_scores.mean():.3f}±{cv_scores.std():.3f}")
    
    return results

def hyperparameter_tuning(X_train, y_train):
    """
    Hyperparameter tuning for the best model
    """
    
    # Example: XGBoost hyperparameter tuning
    param_grid = {
        'n_estimators': [50, 100, 200],
        'max_depth': [4, 6, 8],
        'learning_rate': [0.05, 0.1, 0.2],
        'subsample': [0.8, 0.9, 1.0],
        'colsample_bytree': [0.8, 0.9, 1.0]
    }
    
    xgb_model = xgb.XGBRegressor(random_state=42)
    
    grid_search = GridSearchCV(
        xgb_model,
        param_grid,
        cv=5,
        scoring='r2',
        n_jobs=-1,
        verbose=1
    )
    
    grid_search.fit(X_train, y_train)
    
    print(f"Best parameters: {grid_search.best_params_}")
    print(f"Best CV score: {grid_search.best_score_:.3f}")
    
    return grid_search.best_estimator_

def ensemble_methods(models_dict, X_test, y_test):
    """
    Create ensemble predictions from multiple models
    """
    
    predictions = {}
    
    # Get predictions from each model
    for name, result in models_dict.items():
        predictions[name] = result['model'].predict(X_test)
    
    # Simple averaging ensemble
    ensemble_pred = np.mean(list(predictions.values()), axis=0)
    
    # Weighted averaging (based on individual model performance)
    weights = []
    for name in predictions.keys():
        r2 = models_dict[name]['R²']
        weights.append(max(0, r2))  # Only positive weights
    
    weights = np.array(weights) / np.sum(weights)
    weighted_ensemble_pred = np.average(list(predictions.values()), axis=0, weights=weights)
    
    # Evaluate ensembles
    mae_simple = mean_absolute_error(y_test, ensemble_pred)
    r2_simple = r2_score(y_test, ensemble_pred)
    
    mae_weighted = mean_absolute_error(y_test, weighted_ensemble_pred)
    r2_weighted = r2_score(y_test, weighted_ensemble_pred)
    
    print(f"Simple Ensemble: MAE={mae_simple:.2f}, R²={r2_simple:.3f}")
    print(f"Weighted Ensemble: MAE={mae_weighted:.2f}, R²={r2_weighted:.3f}")
    
    return {
        'simple_ensemble': ensemble_pred,
        'weighted_ensemble': weighted_ensemble_pred,
        'simple_mae': mae_simple,
        'weighted_mae': mae_weighted,
        'simple_r2': r2_simple,
        'weighted_r2': r2_weighted
    }

# Example usage
if __name__ == "__main__":
    # This would be used with your actual training data
    print("Advanced ML Models for MFL Position Rating Prediction")
    print("=" * 60)
    print("1. Random Forest - Good for non-linear relationships")
    print("2. Gradient Boosting - Excellent for structured data")
    print("3. XGBoost - State-of-the-art for tabular data")
    print("4. LightGBM - Fast and memory efficient")
    print("5. SVR - Good for complex non-linear patterns")
    print("6. Neural Network - Can capture complex interactions")
    print("7. Ensemble Methods - Combine multiple models")
    print("\nExpected improvements: 2-5% accuracy increase")








