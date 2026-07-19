Asset
          </label>
          <select
            id="asset"
            name="asset"
            value={formData.asset}
            onChange={handleChange}
            className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
          >
            <option value="USDC">USDC</option>
            <option value="XLM">XLM</option>
          </select>
        </div>

        {error && (
          <div className="bg-red-100 text-red-700 p-3 rounded-lg" role="alert">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-100 text-green-700 p-3 rounded-lg" role="status">
            ✅ Vault created successfully!
          </div>
        )}

        <Button
          type="submit"
          variant="primary"
          className="w-full"
          isLoading={isProcessing}
          disabled={isProcessing}
        >
          {isProcessing ? 'Creating...' : 'Create Vault'}
        </Button>
      </form>
    </Card>
  );
}