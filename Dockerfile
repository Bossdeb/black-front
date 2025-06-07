FROM node:16-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

# Create uploads directory
RUN mkdir -p uploads

# Set environment variables
ENV MONGODB_URI=mongodb://admin:password123@mongodb:27017/stock_management?authSource=admin
ENV JWT_SECRET=your_jwt_secret_key
ENV PORT=3000

EXPOSE 3000

CMD ["npm", "run", "dev"] 