export class AuthService {
  static async loginUser(email, password) {
    if (!email || !password) {
    }
  }

  static async registerUser(userData) {
    // 1. Check if the email is already taken
    const existingUser = await User.findOne({email: userData.email});
    if (existingUser) {
      throw new AppError("Email is already in use", 400);
    }

    // 2. Create the user (Mongoose .pre('save') hook will automatically hash the password)
    const newUser = await User.create({
      name: userData.name,
      email: userData.email,
      password: userData.password,
      role: userData.role,
    });

    // 3. Remove the password from the returned object before handing it back
    newUser.password = undefined;

    return newUser;
  }
}
